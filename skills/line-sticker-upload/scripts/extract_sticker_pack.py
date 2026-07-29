#!/usr/bin/env python3
"""Extract line-stickers-pack.zip to project sticker-pack/ folder."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path


def extract_pack(zip_path: Path, output_dir: Path) -> int:
    if output_dir.exists():
        for child in output_dir.iterdir():
            if child.is_file():
                child.unlink()
            elif child.is_dir():
                import shutil

                shutil.rmtree(child)
    else:
        output_dir.mkdir(parents=True)

    count = 0
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name
            if not name.lower().endswith(".png"):
                continue
            target = output_dir / name
            target.write_bytes(zf.read(info.filename))
            count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract sticker PNGs from ZIP.")
    parser.add_argument(
        "zip_path",
        type=Path,
        nargs="?",
        default=Path("line-stickers-pack.zip"),
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("sticker-pack"),
        help="Output directory (default: sticker-pack)",
    )
    args = parser.parse_args()
    if not args.zip_path.is_file():
        raise SystemExit(f"ZIP not found: {args.zip_path}")
    total = extract_pack(args.zip_path, args.output)
    print(f"OK: extracted {total} PNG files -> {args.output}")


if __name__ == "__main__":
    main()
