#!/usr/bin/env python3
"""Batch LINE upload for sticker set folders under an upload input root.

Uses credentials.env + per-set batch env files (same model as run-line-upload.mts).
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[4]
CREDENTIALS_ENV = PROJECT_ROOT / ".claude/skills/line-sticker-maker/credentials.env"
DEFAULT_BATCH_ENV_DIR = PROJECT_ROOT / ".line-upload" / ".env.batch"
MASTER_STORAGE = SCRIPT_DIR / "playwright_line_state.json"

CREDENTIAL_KEYS = (
    "LINE_EMAIL",
    "LINE_PASSWORD",
    "LINE_CREATOR_ID",
    "GOOGLE_EMAIL",
    "GOOGLE_PASSWORD",
    "GDRIVE_PARENT_FOLDER",
)

from line_playwright_common import (
    load_env,
    normalize_sticker_meta,
    parse_sticker_md,
    sticker_detail_url,
)


def report_text_trim(field: str, raw: str, normalized: str) -> None:
    if raw != normalized:
        print(
            f"{field} trimmed ({len(raw)} -> {len(normalized)}): {normalized}",
            flush=True,
        )


def find_zip(set_dir: Path) -> Path | None:
    for name in (
        "line-stickers-pack.zip",
        "line-stickers-pack (3).zip",
        f"{set_dir.name}.zip",
    ):
        candidate = set_dir / name
        if candidate.is_file():
            return candidate
    for pattern in ("line-stickers-pack*.zip", "*.zip"):
        for candidate in sorted(set_dir.glob(pattern)):
            if candidate.is_file():
                return candidate
    return None


def rel_posix(path: Path) -> str:
    return path.relative_to(PROJECT_ROOT).as_posix()


def safe_env_name(set_name: str) -> str:
    return re.sub(r"[^\w\-]+", "_", set_name).strip("_")[:96]


def merge_credentials(batch_path: Path, credentials_path: Path) -> None:
    cred = load_env(credentials_path)
    batch = load_env(batch_path)
    for key in CREDENTIAL_KEYS:
        if cred.get(key):
            batch[key] = cred[key]
    lines = [f"# LINE Creators Market — {batch.get('GDRIVE_SET_FOLDER', batch_path.stem)}", ""]
    for key, value in batch.items():
        lines.append(f"{key}={value}")
    batch_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def update_env(env_path: Path, set_dir: Path, meta: dict[str, str], zip_path: Path) -> None:
    header = f"# LINE Creators Market — {set_dir.name}"
    updates = {
        "LINE_STICKER_ID": "",
        "GDRIVE_SET_FOLDER": set_dir.name,
        "GDRIVE_STICKER_SUBFOLDER": "sticker-pack",
        "GDRIVE_FOLDER_ID": "",
        "GDRIVE_SHARE_URL": "",
        "STICKER_TITLE_ZH": meta.get("STICKER_TITLE_ZH", ""),
        "STICKER_DESC_ZH": meta.get("STICKER_DESC_ZH", ""),
        "STICKER_TITLE_EN": meta.get("STICKER_TITLE_EN", ""),
        "STICKER_DESC_EN": meta.get("STICKER_DESC_EN", ""),
        "SOURCE_ZIP": rel_posix(zip_path),
        "UPLOAD_ZIP": rel_posix(zip_path),
        "SPRITE_SHEETS_DIR": rel_posix(set_dir / "sprite_sheets"),
    }
    env_path.write_text(
        header
        + "\n# Account secrets merged from credentials.env\n\n"
        + "\n".join(f"{key}={value}" for key, value in updates.items())
        + "\n",
        encoding="utf-8",
    )


def prepare_set_env(
    credentials_env: Path,
    batch_env_dir: Path,
    set_dir: Path,
    meta: dict[str, str],
    zip_path: Path,
) -> Path:
    batch_env_dir.mkdir(parents=True, exist_ok=True)
    env_path = batch_env_dir / f"{safe_env_name(set_dir.name)}.env"
    update_env(env_path, set_dir, meta, zip_path)
    merge_credentials(env_path, credentials_env)
    return env_path


def run_step(name: str, cmd: list[str], *, continue_on_error: bool, env: dict[str, str]) -> bool:
    print(f"\n=== {name} ===", flush=True)
    result = subprocess.run(cmd, cwd=PROJECT_ROOT, env=env)
    if result.returncode != 0:
        print(f"FAILED: {name} (exit {result.returncode})", flush=True)
        if not continue_on_error:
            raise SystemExit(result.returncode)
        return False
    return True


def discover_sets(base: Path) -> list[Path]:
    sets: list[Path] = []
    for child in sorted(base.iterdir()):
        if not child.is_dir():
            continue
        md_files = list(child.glob("*.md"))
        if not md_files:
            continue
        if find_zip(child) is None:
            print(f"Skip (no ZIP): {child.name}", flush=True)
            continue
        sets.append(child)
    return sets


@dataclass(frozen=True)
class SetJob:
    set_dir: str
    credentials_env: str
    batch_env_dir: str
    worker_id: int
    skip_drive: bool
    skip_provision: bool
    skip_zip: bool
    skip_submit: bool
    headless_provision: bool
    no_pause_provision: bool
    continue_on_error: bool


def worker_storage_path(worker_id: int) -> Path:
    return SCRIPT_DIR / f"playwright_line_state.w{worker_id}.json"


def process_one_set(job: SetJob) -> tuple[str, str | None, bool]:
    set_dir = Path(job.set_dir)
    name = set_dir.name
    py = sys.executable
    scripts = SCRIPT_DIR
    credentials_env = Path(job.credentials_env)
    batch_env_dir = Path(job.batch_env_dir)

    print(f"\n{'=' * 60}\nProcessing [{job.worker_id}]: {name}\n{'=' * 60}", flush=True)

    zip_path = find_zip(set_dir)
    if zip_path is None:
        return name, None, False

    md_path = next(iter(set_dir.glob("*.md")))
    meta = normalize_sticker_meta(parse_sticker_md(md_path), set_dir.name)
    env_path = prepare_set_env(credentials_env, batch_env_dir, set_dir, meta, zip_path)

    worker_storage = worker_storage_path(job.worker_id)
    if MASTER_STORAGE.is_file():
        shutil.copy2(MASTER_STORAGE, worker_storage)

    child_env = os.environ.copy()
    child_env["LINE_PLAYWRIGHT_STATE"] = str(worker_storage)
    env_flag = ["--env", str(env_path)]

    ok = True
    if not job.skip_drive:
        ok = run_step(
            "Drive (stage + upload)",
            [
                py,
                str(scripts / "upload_gdrive.py"),
                "--stage",
                "--project-root",
                str(PROJECT_ROOT),
                *env_flag,
            ],
            continue_on_error=job.continue_on_error,
            env=child_env,
        ) and ok

    prov_cmd = [py, str(scripts / "provision_line_sticker.py"), *env_flag]
    if job.headless_provision:
        prov_cmd.append("--headless")
    if job.no_pause_provision:
        prov_cmd.append("--no-pause-before-save")
    if not job.skip_provision and ok:
        ok = run_step("Provision", prov_cmd, continue_on_error=job.continue_on_error, env=child_env) and ok

    if not job.skip_zip and ok:
        ok = run_step(
            "ZIP upload",
            [
                py,
                str(scripts / "upload_line_zip.py"),
                *env_flag,
                "--post-upload-pause",
                "12",
            ],
            continue_on_error=job.continue_on_error,
            env=child_env,
        ) and ok

    project_url: str | None = None
    if not job.skip_submit and ok:
        submit_cmd = [py, str(scripts / "submit_line_review.py"), *env_flag, "--headless"]
        if run_step("Submit review", submit_cmd, continue_on_error=job.continue_on_error, env=child_env):
            env_data = load_env(env_path)
            creator = env_data.get("LINE_CREATOR_ID", "")
            sid = env_data.get("LINE_STICKER_ID", "")
            if creator and sid:
                project_url = sticker_detail_url(creator, sid)
                print(f"PROJECT_URL={project_url}", flush=True)
        else:
            ok = False

    if worker_storage.is_file() and MASTER_STORAGE.is_file():
        try:
            if worker_storage.stat().st_mtime >= MASTER_STORAGE.stat().st_mtime:
                shutil.copy2(worker_storage, MASTER_STORAGE)
        except OSError:
            pass

    return name, project_url, ok


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch LINE sticker upload for folders under a base path.")
    parser.add_argument(
        "base_dir",
        type=Path,
        help="Upload input root, e.g. .line-upload/input/706",
    )
    parser.add_argument(
        "--credentials",
        type=Path,
        default=CREDENTIALS_ENV,
        help="Shared credentials.env path",
    )
    parser.add_argument(
        "--batch-env-dir",
        type=Path,
        default=DEFAULT_BATCH_ENV_DIR,
        help="Directory for generated per-set batch env files",
    )
    parser.add_argument("--skip-drive", action="store_true")
    parser.add_argument("--skip-provision", action="store_true")
    parser.add_argument("--skip-zip", action="store_true")
    parser.add_argument("--skip-submit", action="store_true")
    parser.add_argument(
        "--headless-provision",
        action="store_true",
        help="Use headless browser for provision (may fail if LINE login/2FA needed)",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Process remaining sets after a step failure",
    )
    parser.add_argument("--only", help="Process one set folder name under base_dir")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Skip set folder name(s); repeat for multiple",
    )
    parser.add_argument(
        "--no-pause-provision",
        action="store_true",
        help="Save provision form without waiting for Enter (batch runs)",
    )
    parser.add_argument(
        "--parallel",
        type=int,
        default=1,
        metavar="N",
        help="Process N sticker sets concurrently (default: 1)",
    )
    args = parser.parse_args()

    base = args.base_dir.resolve()
    if not base.is_dir():
        raise SystemExit(f"Not a directory: {base}")

    credentials_env = args.credentials.resolve()
    if not credentials_env.is_file():
        raise SystemExit(f"Missing credentials file: {credentials_env}")

    batch_env_dir = args.batch_env_dir.resolve()

    parallel = max(1, args.parallel)
    if parallel > 1 and not args.headless_provision:
        print("Parallel mode: using --headless-provision for stability.", flush=True)
        args.headless_provision = True
    if parallel > 1 and not args.no_pause_provision:
        args.no_pause_provision = True

    pending: list[Path] = []
    for set_dir in discover_sets(base):
        name = set_dir.name
        if args.only and name != args.only:
            continue
        if name in args.exclude:
            print(f"Skip (excluded): {name}", flush=True)
            continue
        pending.append(set_dir)

    jobs: list[SetJob] = []
    for index, set_dir in enumerate(pending):
        jobs.append(
            SetJob(
                set_dir=str(set_dir.resolve()),
                credentials_env=str(credentials_env),
                batch_env_dir=str(batch_env_dir),
                worker_id=(index % parallel) + 1,
                skip_drive=args.skip_drive,
                skip_provision=args.skip_provision,
                skip_zip=args.skip_zip,
                skip_submit=args.skip_submit,
                headless_provision=args.headless_provision,
                no_pause_provision=args.no_pause_provision,
                continue_on_error=args.continue_on_error,
            )
        )

    results: list[tuple[str, str | None]] = []
    if parallel == 1:
        for job in jobs:
            name, url, _ = process_one_set(job)
            results.append((name, url))
    else:
        with ProcessPoolExecutor(max_workers=parallel) as pool:
            futures = {pool.submit(process_one_set, job): job for job in jobs}
            for future in as_completed(futures):
                name, url, ok = future.result()
                results.append((name, url))
                if not ok and not args.continue_on_error:
                    for pending_future in futures:
                        if not pending_future.done():
                            pending_future.cancel()
                    break

    results.sort(key=lambda item: item[0])
    print("\n\n=== Batch summary ===", flush=True)
    for name, url in results:
        print(f"{name}\n  {url or '(no PROJECT_URL)'}\n", flush=True)


if __name__ == "__main__":
    main()
