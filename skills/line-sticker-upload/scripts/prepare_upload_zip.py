#!/usr/bin/env python3
"""Flatten a sticker ZIP for LINE Creators Market batch upload."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path

REQUIRED_ROOT_NAMES = {"main.png", "tab.png"}


def flatten_zip(source: Path, output: Path) -> int:
    png_count = 0
    with zipfile.ZipFile(source) as zin, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name
            if not name.lower().endswith(".png"):
                continue
            zout.writestr(name, zin.read(info.filename))
            png_count += 1
    return png_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare LINE upload ZIP with flat PNG names.")
    parser.add_argument("source", type=Path, help="Source ZIP (may contain subfolders)")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("upload-ready.zip"),
        help="Output ZIP path (default: upload-ready.zip)",
    )
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Source not found: {args.source}")

    count = flatten_zip(args.source, args.output)
    with zipfile.ZipFile(args.output) as zout:
        names = set(zout.namelist())
    missing = REQUIRED_ROOT_NAMES - names
    if missing:
        raise SystemExit(f"Missing required files in output: {sorted(missing)}")
    print(f"OK: {count} PNG files -> {args.output}")


if __name__ == "__main__":
    main()
