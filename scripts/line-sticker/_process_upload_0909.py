#!/usr/bin/env python3
"""Convert inbox/貼圖0909 (4 sets × 2 already-keyed sheets) and pack for LINE upload."""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts" / "line-sticker" / "python"))

from sheet_converter_v2.pipeline import ConvertOptions, convert_batch  # noqa: E402

INBOX = next(p for p in (REPO / "inbox").iterdir() if p.is_dir() and "0909" in p.name)
OUT_ROOT = REPO / "output" / "inbox-0909"
UPLOAD_ROOT = REPO / ".line-upload" / "input" / "706"

# Folder name (ZH) → shop listing + ASCII upload folder name
SETS: dict[str, dict[str, str]] = {
    "花花：已讀亂回": {
        "upload_name": "Huahua Read Reply Chaos",
        "title_zh": "花花：已讀亂回",
        "desc_zh": "已讀不回？亂回一通再說。三花貓日常回覆語錄。",
        "title_en": "Huahua Read Reply Chaos",
        "desc_en": "Read receipts, chaotic replies, and calico cat chat energy.",
    },
    "花花：羽球嘴砲王": {
        "upload_name": "Huahua Badminton Trash Talk",
        "title_zh": "花花：羽球嘴砲王",
        "desc_zh": "球場嘴砲全開，三花貓羽球戰鬥語錄。",
        "title_en": "Huahua Badminton Trash Talk",
        "desc_en": "Court-side trash talk from a calico badminton menace.",
    },
    "花花：羽球王": {
        "upload_name": "Huahua Badminton King",
        "title_zh": "花花：羽球王",
        "desc_zh": "殺球、接球、慶祝——三花貓羽球日常。",
        "title_en": "Huahua Badminton King",
        "desc_en": "Smash, rally, celebrate — calico cat badminton vibes.",
    },
    "花花：腦袋當機中": {
        "upload_name": "Huahua Brain Buffering",
        "title_zh": "花花：腦袋當機中",
        "desc_zh": "當機、空白、重新開機。三花貓當機語錄。",
        "title_en": "Huahua Brain Buffering",
        "desc_en": "Buffering brain, empty stare, reboot mode calico moods.",
    },
}


def fit_main(rgba: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
    im = rgba.convert("RGBA")
    im.thumbnail((240, 240), Image.Resampling.LANCZOS)
    x = (240 - im.width) // 2
    y = (240 - im.height) // 2
    canvas.paste(im, (x, y), im)
    return canvas


def fit_tab(rgba: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (96, 74), (0, 0, 0, 0))
    im = rgba.convert("RGBA")
    im.thumbnail((96, 74), Image.Resampling.LANCZOS)
    x = (96 - im.width) // 2
    y = (74 - im.height) // 2
    canvas.paste(im, (x, y), im)
    return canvas


def write_md(path: Path, meta: dict[str, str]) -> None:
    path.write_text(
        "\n".join(
            [
                "# Traditional Chinese",
                "",
                "## Title",
                meta["title_zh"],
                "",
                "## Description",
                meta["desc_zh"],
                "",
                "---",
                "",
                "# English",
                "",
                "## Title",
                meta["title_en"],
                "",
                "## Description",
                meta["desc_en"],
                "",
            ]
        ),
        encoding="utf-8",
    )


def list_sheets(src_dir: Path) -> list[Path]:
    """Prefer already-keyed PNGs; fall back to JPG only if no PNG present."""
    pngs = sorted(src_dir.glob("*.png"))
    if len(pngs) >= 2:
        return pngs[:2]
    jpgs = sorted(src_dir.glob("*.jpg")) + sorted(src_dir.glob("*.jpeg"))
    return jpgs[:2]


def convert_one_set(src_dir: Path, out_dir: Path) -> list[Path]:
    """Convert 2 sheets → set1/ + set2/ numbered PNGs. Returns sticker paths 01..40."""
    work = out_dir / "_sheets_in"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    sheets = list_sheets(src_dir)
    if len(sheets) < 2:
        raise RuntimeError(f"Need 2 sheets in {src_dir}, found {len(sheets)}")
    for i, sheet in enumerate(sheets, start=1):
        dest = work / f"{i:03d}.png"
        Image.open(sheet).convert("RGBA").save(dest)
    if out_dir.exists():
        for child in out_dir.iterdir():
            if child.name.startswith("set"):
                shutil.rmtree(child)
    # Already-keyed ChatGPT RGBA sheets — slice only, do not re-key
    opts = ConvertOptions(cols=4, rows=5, start_index=1, skip_key=True)
    convert_batch(work, out_dir, opts, make_zip=False)
    stickers: list[Path] = []
    for i in range(1, 41):
        folder = "set1" if i <= 20 else "set2"
        path = out_dir / folder / f"{i:02d}.png"
        if not path.is_file():
            raise RuntimeError(f"Missing sticker {path}")
        stickers.append(path)
    return stickers


def pack_upload(stickers: list[Path], convert_out: Path, meta: dict[str, str]) -> Path:
    name = meta["upload_name"]
    dest = UPLOAD_ROOT / name
    if dest.exists():
        shutil.rmtree(dest)
    pack = dest / "sticker-pack"
    sheets_dir = dest / "sprite_sheets"
    pack.mkdir(parents=True)
    sheets_dir.mkdir(parents=True)

    for i, src in enumerate(stickers, start=1):
        shutil.copy2(src, pack / f"{i:02d}.png")

    main_src = Image.open(stickers[0]).convert("RGBA")
    tab_src = Image.open(stickers[min(1, len(stickers) - 1)]).convert("RGBA")
    fit_main(main_src).save(pack / "main.png")
    fit_tab(tab_src).save(pack / "tab.png")

    for idx, set_name in enumerate(("set1", "set2"), start=1):
        keyed = convert_out / set_name / "_v2_keyed_sheet.png"
        if keyed.is_file():
            shutil.copy2(keyed, sheets_dir / f"sheet-{idx}.png")

    zip_path = dest / "line-stickers-pack.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(pack.iterdir()):
            zf.write(p, arcname=p.name)

    write_md(dest / f"{name}.md", meta)
    shutil.copy2(zip_path, dest / f"{name}.zip")
    print(f"packed {name}: {len(stickers)} stickers → {dest}")
    return dest


def main() -> int:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    src_dirs = sorted([p for p in INBOX.iterdir() if p.is_dir()], key=lambda p: p.name)
    if len(src_dirs) != 4:
        print(f"WARN: expected 4 set folders, found {len(src_dirs)}")

    packed: list[Path] = []
    for src in src_dirs:
        meta = SETS.get(src.name)
        if meta is None:
            key = next((k for k in SETS if k in src.name or src.name in k), None)
            if key is None:
                raise RuntimeError(f"No listing meta for folder {src.name!r}")
            meta = SETS[key]
            print(f"matched {src.name!r} → {key!r}")
        else:
            print(f"processing {src.name}")

        safe = re.sub(r"[^\w\-]+", "_", meta["upload_name"]).strip("_")
        convert_out = OUT_ROOT / safe
        convert_out.mkdir(parents=True, exist_ok=True)
        stickers = convert_one_set(src, convert_out)
        packed.append(pack_upload(stickers, convert_out, meta))

    print("\nDone. Upload folders:")
    for p in packed:
        print(f"  {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
