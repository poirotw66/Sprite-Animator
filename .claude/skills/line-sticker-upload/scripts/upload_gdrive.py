#!/usr/bin/env python3
"""
Upload sticker PNGs to Google Drive and return a public folder link.

One-time setup:
  1. Google Cloud Console -> create project -> enable "Google Drive API"
  2. Credentials -> Create OAuth client ID -> Desktop app
  3. Download JSON -> save as gdrive_credentials.json next to this script
  4. Run: python upload_gdrive.py --auth-only

Usage (from project root):
  python .claude/skills/line-sticker-upload/scripts/upload_gdrive.py --stage
  # Reads SOURCE_ZIP + SPRITE_SHEETS_DIR from .env; uploads directly (no _gdrive_upload copy).

Legacy disk staging (optional):
  python upload_gdrive.py --use-staging --stage
"""

from __future__ import annotations

import argparse
import io
import mimetypes
import re
import shutil
import sys
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

SCRIPT_DIR = Path(__file__).resolve().parent
TOKEN_PATH = SCRIPT_DIR / "gdrive_token.json"
CREDENTIALS_PATH = SCRIPT_DIR / "gdrive_credentials.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]
FOLDER_MIME = "application/vnd.google-apps.folder"
DEFAULT_WORKERS = 10
NON_RESUMABLE_MAX_BYTES = 5 * 1024 * 1024
# ponytail: one Drive client per thread; global lock was serializing all "parallel" uploads.
_thread_local = threading.local()
# Windows paths + staging; Drive folder names should avoid these too.
_WIN_INVALID_PATH_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_set_folder_name(env: dict[str, str]) -> str:
    """
    Folder name for Drive + _gdrive_upload staging.
    Prefer GDRIVE_SET_FOLDER (batch sets this to the set directory name, not EN title).
    """
    raw = (
        env.get("GDRIVE_SET_FOLDER", "").strip()
        or env.get("STICKER_TITLE_EN", "").strip()
        or "sticker-set"
    )
    name = _WIN_INVALID_PATH_CHARS.sub("_", raw)
    name = name.replace(":", "_").strip(" .")
    return name or "sticker-set"


def staging_dir_for_set(root: Path, env: dict[str, str]) -> Path:
    """Isolated staging under _gdrive_upload/{safe_name}/ — never project-root sticker-pack/."""
    return root / "_gdrive_upload" / safe_set_folder_name(env)


@dataclass(frozen=True)
class UploadTask:
    filename: str
    parent_id: str
    label: str
    path: Path | None = None
    data: bytes | None = None


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.is_file():
        return values
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, raw = line.partition("=")
        values[key.strip()] = raw.strip()
    return values


def project_root_from_arg(value: Path | None) -> Path:
    if value is not None:
        return value.resolve()
    return SCRIPT_DIR.parents[4]


def load_credentials(auth_only: bool) -> Credentials:
    creds: Credentials | None = None
    if TOKEN_PATH.is_file():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except RefreshError:
            creds = None
            if TOKEN_PATH.is_file():
                TOKEN_PATH.unlink()
                print("Drive token expired; starting OAuth again.", flush=True)
    if not creds or not creds.valid:
        if not CREDENTIALS_PATH.is_file():
            raise SystemExit(
                "Missing gdrive_credentials.json\n\n"
                f"Expected path: {CREDENTIALS_PATH}\n"
                "Create a Desktop OAuth client in Google Cloud Console, "
                "enable Drive API, download JSON and rename it."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
        creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
        print(f"Saved token: {TOKEN_PATH}")
    if auth_only:
        print("Auth OK. You can upload now.")
        sys.exit(0)
    return creds


def escape_drive_query(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def drive_service_for_thread(creds: Credentials) -> Any:
    service = getattr(_thread_local, "drive_service", None)
    if service is None:
        service = build("drive", "v3", credentials=creds, cache_discovery=False)
        _thread_local.drive_service = service
    return service


def list_existing_files_in_folders(service: Any, folder_ids: list[str]) -> set[tuple[str, str]]:
    """Flat list per folder (stickers + sprites); faster than a full recursive tree walk."""
    existing: set[tuple[str, str]] = set()
    for folder_id in folder_ids:
        page_token: str | None = None
        while True:
            response = (
                service.files()
                .list(
                    q=(
                        f"'{folder_id}' in parents and trashed = false "
                        f"and mimeType != '{FOLDER_MIME}'"
                    ),
                    fields="nextPageToken, files(name)",
                    pageToken=page_token,
                    pageSize=1000,
                )
                .execute()
            )
            for item in response.get("files", []):
                existing.add((folder_id, item["name"]))
            page_token = response.get("nextPageToken")
            if not page_token:
                break
    return existing


def list_existing_files_tree(service: Any, root_folder_id: str) -> set[tuple[str, str]]:
    """One recursive listing: (parent_folder_id, filename) for all files under root."""
    existing: set[tuple[str, str]] = set()
    folders: list[str] = [root_folder_id]
    while folders:
        folder_id = folders.pop()
        page_token: str | None = None
        while True:
            response = (
                service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    fields="nextPageToken, files(id, name, mimeType)",
                    pageToken=page_token,
                    pageSize=200,
                )
                .execute()
            )
            for item in response.get("files", []):
                if item.get("mimeType") == FOLDER_MIME:
                    folders.append(item["id"])
                else:
                    existing.add((folder_id, item["name"]))
            page_token = response.get("nextPageToken")
            if not page_token:
                break
    return existing


def find_child_folder(service: Any, parent_id: str, name: str) -> str | None:
    safe_name = escape_drive_query(name)
    query = (
        f"'{parent_id}' in parents and name = '{safe_name}' "
        f"and mimeType = '{FOLDER_MIME}' and trashed = false"
    )
    response = service.files().list(q=query, fields="files(id)", pageSize=1).execute()
    files = response.get("files", [])
    return files[0]["id"] if files else None


def ensure_child_folder(service: Any, parent_id: str, name: str) -> str:
    existing = find_child_folder(service, parent_id, name)
    if existing:
        return existing
    meta = {
        "name": name,
        "parents": [parent_id],
        "mimeType": FOLDER_MIME,
    }
    created = service.files().create(body=meta, fields="id").execute()
    return created["id"]


def resolve_zip_path(root: Path, env: dict[str, str]) -> Path | None:
    for key in ("SOURCE_ZIP", "UPLOAD_ZIP"):
        relative = env.get(key, "").strip()
        if relative:
            candidate = (root / relative).resolve()
            if candidate.is_file():
                return candidate
    return None


def collect_tasks_from_zip(zip_path: Path, parent_id: str, label: str) -> list[UploadTask]:
    tasks: list[UploadTask] = []
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name
            if not name.lower().endswith(".png"):
                continue
            tasks.append(
                UploadTask(
                    filename=name,
                    parent_id=parent_id,
                    label=label,
                    data=archive.read(info.filename),
                )
            )
    return tasks


def collect_tasks_from_dir(local_dir: Path, parent_id: str, label: str) -> list[UploadTask]:
    return [
        UploadTask(filename=path.name, parent_id=parent_id, label=label, path=path)
        for path in sorted(local_dir.glob("*.png"))
    ]


def collect_tasks_from_env(
    service: Any,
    root: Path,
    env: dict[str, str],
    set_folder_id: str,
    sticker_subfolder: str,
) -> list[UploadTask]:
    sticker_drive_id = ensure_child_folder(service, set_folder_id, sticker_subfolder)
    tasks: list[UploadTask] = []
    sprite_rel = env.get("SPRITE_SHEETS_DIR", "sprite_sheets").strip()
    set_base = (root / sprite_rel).resolve().parent if sprite_rel else root

    zip_path = resolve_zip_path(root, env)
    if zip_path:
        tasks.extend(collect_tasks_from_zip(zip_path, sticker_drive_id, sticker_subfolder))
    else:
        beside_pack = set_base / sticker_subfolder
        if beside_pack.is_dir():
            tasks.extend(
                collect_tasks_from_dir(beside_pack, sticker_drive_id, sticker_subfolder)
            )

    sprite_dir = (root / sprite_rel).resolve() if sprite_rel else None
    if sprite_dir and sprite_dir.is_dir():
        tasks.extend(collect_tasks_from_dir(sprite_dir, set_folder_id, "sprites"))

    if not tasks:
        raise SystemExit(
            "No PNG sources found. Set SOURCE_ZIP and/or SPRITE_SHEETS_DIR in .env."
        )
    return tasks


def collect_tasks_from_local_set(
    service: Any,
    local_set_dir: Path,
    set_folder_id: str,
    sticker_subfolder: str,
) -> list[UploadTask]:
    sticker_local = local_set_dir / sticker_subfolder
    if not sticker_local.is_dir():
        raise SystemExit(f"Missing local folder: {sticker_local}")
    sticker_drive_id = ensure_child_folder(service, set_folder_id, sticker_subfolder)
    tasks = collect_tasks_from_dir(sticker_local, sticker_drive_id, sticker_subfolder)
    tasks.extend(collect_tasks_from_dir(local_set_dir, set_folder_id, "sprites"))
    return tasks


def execute_upload(creds: Credentials, task: UploadTask) -> None:
    service = drive_service_for_thread(creds)
    mime, _ = mimetypes.guess_type(task.filename)
    content_type = mime or "image/png"
    meta = {"name": task.filename, "parents": [task.parent_id]}
    if task.path is not None:
        size = task.path.stat().st_size
        media = MediaFileUpload(
            str(task.path),
            mimetype=content_type,
            resumable=size > NON_RESUMABLE_MAX_BYTES,
        )
    elif task.data is not None:
        size = len(task.data)
        media = MediaIoBaseUpload(
            io.BytesIO(task.data),
            mimetype=content_type,
            resumable=size > NON_RESUMABLE_MAX_BYTES,
        )
    else:
        raise ValueError(f"No payload for {task.filename}")
    service.files().create(body=meta, media_body=media, fields="id,name").execute()


def upload_tasks_parallel(
    creds: Credentials,
    tasks: list[UploadTask],
    existing: set[tuple[str, str]],
    skip_existing: bool,
    workers: int,
) -> list[str]:
    if not tasks:
        return []

    print_lock = threading.Lock()
    to_upload: list[UploadTask] = []
    skipped = 0
    for task in tasks:
        if skip_existing and (task.parent_id, task.filename) in existing:
            skipped += 1
            with print_lock:
                print(f"{task.label}: Skip (exists): {task.filename}")
        else:
            to_upload.append(task)

    if not to_upload:
        print(f"All {skipped} file(s) already on Drive.")
        return []

    uploaded: list[str] = []
    total = len(to_upload)
    done = 0

    def worker(task: UploadTask) -> str:
        execute_upload(creds, task)
        return task.filename

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(worker, task): task for task in to_upload}
        for future in as_completed(futures):
            task = futures[future]
            future.result()
            done += 1
            uploaded.append(task.filename)
            with print_lock:
                print(
                    f"{task.label}: [{done}/{total}] Uploaded: {task.filename}",
                    flush=True,
                )

    if skipped:
        print(f"Skipped {skipped} existing file(s).")
    return uploaded


def share_folder(service: Any, folder_id: str) -> str:
    try:
        service.permissions().create(
            fileId=folder_id,
            body={"type": "anyone", "role": "reader"},
        ).execute()
    except Exception as exc:
        if "already exists" not in str(exc).lower():
            raise
    meta = service.files().get(fileId=folder_id, fields="webViewLink").execute()
    return meta["webViewLink"]


def stage_upload_dir(root: Path, env: dict[str, str]) -> Path:
    """Legacy (--use-staging): unpack only under _gdrive_upload/{safe_set_name}/."""
    sticker_sub = env.get("GDRIVE_STICKER_SUBFOLDER", "sticker-pack")
    sprite_rel = env.get("SPRITE_SHEETS_DIR", "sprite_sheets").strip()
    sprite_dir = (root / sprite_rel).resolve()
    target = staging_dir_for_set(root, env)
    target_stickers = target / sticker_sub

    if target.exists():
        shutil.rmtree(target)
    target_stickers.mkdir(parents=True)

    zip_path = resolve_zip_path(root, env)
    if not zip_path:
        raise SystemExit(
            "SOURCE_ZIP not found in .env. "
            f"Staging does not extract to project-root {sticker_sub}/."
        )
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name
            if name.lower().endswith(".png"):
                (target_stickers / name).write_bytes(archive.read(info.filename))

    if sprite_dir.is_dir():
        for src in sprite_dir.glob("*.png"):
            shutil.copy2(src, target / src.name)
    return target


def update_env_share_url(env_path: Path, url: str) -> None:
    if not env_path.is_file():
        return
    text = env_path.read_text(encoding="utf-8")
    if re.search(r"^GDRIVE_SHARE_URL=.*$", text, flags=re.MULTILINE):
        text = re.sub(
            r"^GDRIVE_SHARE_URL=.*$",
            f"GDRIVE_SHARE_URL={url}",
            text,
            flags=re.MULTILINE,
        )
    else:
        text = text.rstrip() + f"\nGDRIVE_SHARE_URL={url}\n"
    env_path.write_text(text, encoding="utf-8")


def update_env_folder_id(env_path: Path, folder_id: str) -> None:
    if not env_path.is_file():
        return
    text = env_path.read_text(encoding="utf-8")
    if re.search(r"^GDRIVE_FOLDER_ID=.*$", text, flags=re.MULTILINE):
        text = re.sub(
            r"^GDRIVE_FOLDER_ID=.*$",
            f"GDRIVE_FOLDER_ID={folder_id}",
            text,
            flags=re.MULTILINE,
        )
    else:
        text = text.rstrip() + f"\nGDRIVE_FOLDER_ID={folder_id}\n"
    env_path.write_text(text, encoding="utf-8")


def resolve_set_folder_id(service: Any, env: dict[str, str], folder_override: str | None) -> str:
    if folder_override:
        return folder_override
    share_url = env.get("GDRIVE_SHARE_URL", "").strip()
    explicit = env.get("GDRIVE_FOLDER_ID", "").strip()
    if explicit and share_url:
        return explicit
    match = re.search(r"/folders/([a-zA-Z0-9_-]+)", share_url)
    if match:
        return match.group(1)
    parent_folder_id = env.get("GDRIVE_PARENT_FOLDER_ID", "").strip()
    if parent_folder_id:
        parent_id = parent_folder_id
    else:
        parent_name = env.get("GDRIVE_PARENT_FOLDER", "LINE-sticker").strip()
        parent_id = find_child_folder(service, "root", parent_name)
        if not parent_id:
            raise SystemExit(
                f"No Drive folder named {parent_name!r} under My Drive root. "
                "Create it or set GDRIVE_PARENT_FOLDER_ID to the LINE-sticker folder ID."
            )
    return ensure_child_folder(service, parent_id, safe_set_folder_name(env))


def run_upload(
    creds: Credentials,
    root: Path,
    env: dict[str, str],
    env_path: Path,
    local_dir: Path | None,
    folder_override: str | None,
    skip_existing: bool,
    workers: int,
    do_share: bool,
) -> None:
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    set_folder_id = resolve_set_folder_id(service, env, folder_override)
    update_env_folder_id(env_path, set_folder_id)
    sticker_sub = env.get("GDRIVE_STICKER_SUBFOLDER", "sticker-pack")
    sticker_drive_id = ensure_child_folder(service, set_folder_id, sticker_sub)

    if skip_existing:
        print("Listing existing Drive files (flat pass)...", flush=True)
        existing = list_existing_files_in_folders(service, [set_folder_id, sticker_drive_id])
    else:
        existing = set()

    if local_dir is not None:
        tasks = collect_tasks_from_local_set(service, local_dir, set_folder_id, sticker_sub)
        source = f"local folder {local_dir}"
    else:
        tasks = collect_tasks_from_env(service, root, env, set_folder_id, sticker_sub)
        source = "ZIP + sprite_sheets (direct)"

    sticker_n = sum(1 for t in tasks if t.label == sticker_sub)
    sprite_n = sum(1 for t in tasks if t.label == "sprites")
    print(f"Source: {source}", flush=True)
    print(f"Queued {sticker_n} sticker PNGs, {sprite_n} sprite PNGs", flush=True)
    print(f"Upload workers: {workers}", flush=True)

    names = upload_tasks_parallel(creds, tasks, existing, skip_existing, workers)
    print(f"Uploaded {len(names)} new file(s).", flush=True)

    if do_share:
        link = share_folder(service, set_folder_id)
        update_env_share_url(env_path, link)
        print(f"SHARE_URL={link}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload PNGs to Google Drive via API.")
    parser.add_argument(
        "local_dir",
        type=Path,
        nargs="?",
        help="Optional local set folder (default: upload from .env ZIP/sprites directly)",
    )
    parser.add_argument("--project-root", type=Path, help="Project root (default: auto)")
    parser.add_argument(
        "--env",
        type=Path,
        required=True,
        help="Per-set batch env (e.g. output/my-set/.env.batch/Set_Name.env)",
    )
    parser.add_argument("--folder-id", help="Drive folder ID override")
    parser.add_argument("--auth-only", action="store_true", help="Run OAuth only, then exit")
    parser.add_argument(
        "--stage",
        action="store_true",
        help="Upload from .env SOURCE_ZIP + SPRITE_SHEETS_DIR (no _gdrive_upload copy)",
    )
    parser.add_argument(
        "--use-staging",
        action="store_true",
        help="Copy to _gdrive_upload/ first (legacy; slower, uses more disk)",
    )
    parser.add_argument("--no-share", action="store_true", help="Do not set public link permission")
    parser.add_argument("--no-skip", action="store_true", help="Re-upload even if filename exists")
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help=f"Parallel upload threads (default: {DEFAULT_WORKERS})",
    )
    args = parser.parse_args()

    root = project_root_from_arg(args.project_root)
    env_path = args.env.resolve()
    env = load_env_file(env_path)

    if args.auth_only:
        load_credentials(auth_only=True)

    local_dir: Path | None = None
    if args.local_dir is not None:
        local_dir = args.local_dir.resolve()
        if not local_dir.is_dir():
            raise SystemExit(f"Not a directory: {local_dir}")
    elif args.use_staging:
        if not args.stage:
            print("Note: --use-staging copies files; combine with --stage or pass local_dir.", flush=True)
        target = stage_upload_dir(root, env)
        sticker_sub = env.get("GDRIVE_STICKER_SUBFOLDER", "sticker-pack")
        sticker_n = len(list((target / sticker_sub).glob("*.png")))
        sprite_n = len(list(target.glob("*.png")))
        print(f"Staged {sticker_n} stickers -> {target / sticker_sub}", flush=True)
        print(f"Staged {sprite_n} sprites at {target}", flush=True)
        local_dir = target
    elif args.stage or resolve_zip_path(root, env):
        local_dir = None
    else:
        fallback = staging_dir_for_set(root, env)
        if fallback.is_dir():
            local_dir = fallback
        else:
            raise SystemExit(
                "No SOURCE_ZIP in .env and no _gdrive_upload folder. "
                "Run with --stage or set SOURCE_ZIP."
            )

    creds = load_credentials(auth_only=False)
    run_upload(
        creds,
        root,
        env,
        env_path,
        local_dir,
        args.folder_id,
        skip_existing=not args.no_skip,
        workers=max(1, args.workers),
        do_share=not args.no_share,
    )


if __name__ == "__main__":
    main()
