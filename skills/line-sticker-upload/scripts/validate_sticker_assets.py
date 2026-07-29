#!/usr/bin/env python3
"""Validate LINE Creators Market static sticker assets."""

from __future__ import annotations

import struct
import sys
from pathlib import Path

ALLOWED_COUNTS = {8, 16, 24, 32, 40}
MAIN_SIZE = (240, 240)
TAB_SIZE = (96, 74)
STICKER_MAX = (370, 320)
MAX_FILE_BYTES = 1_000_000


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        signature = handle.read(8)
        if signature != b"\x89PNG\r\n\x1a\n":
            raise ValueError("not a PNG file")
        chunk_length = handle.read(4)
        if len(chunk_length) != 4:
            raise ValueError("truncated PNG")
        chunk_type = handle.read(4)
        if chunk_type != b"IHDR":
            raise ValueError("missing IHDR chunk")
        width, height = struct.unpack(">II", handle.read(8))
    return width, height


def check_file(path: Path, expected: tuple[int, int] | None, max_size: tuple[int, int]) -> list[str]:
    issues: list[str] = []
    if path.stat().st_size > MAX_FILE_BYTES:
        issues.append(f"{path.name}: file exceeds 1 MB")
    try:
        width, height = read_png_size(path)
    except ValueError as exc:
        return [f"{path.name}: {exc}"]

    if expected is not None:
        if (width, height) != expected:
            issues.append(f"{path.name}: expected {expected[0]}x{expected[1]}, got {width}x{height}")
    elif width > max_size[0] or height > max_size[1]:
        issues.append(f"{path.name}: exceeds max {max_size[0]}x{max_size[1]} (got {width}x{height})")
    elif width % 2 != 0 or height % 2 != 0:
        issues.append(f"{path.name}: width and height should be even pixels")
    return issues


def validate(assets_dir: Path) -> int:
    errors: list[str] = []
    main_path = assets_dir / "main.png"
    tab_path = assets_dir / "tab.png"
    stickers_dir = assets_dir / "stickers"

    if not main_path.is_file():
        errors.append("missing assets/main.png")
    else:
        errors.extend(check_file(main_path, MAIN_SIZE, MAIN_SIZE))

    if not tab_path.is_file():
        errors.append("missing assets/tab.png")
    else:
        errors.extend(check_file(tab_path, TAB_SIZE, TAB_SIZE))

    if not stickers_dir.is_dir():
        errors.append("missing assets/stickers/ directory")
        return print_report(errors)

    sticker_files = sorted(
        stickers_dir.glob("*.png"),
        key=lambda p: int(p.stem) if p.stem.isdigit() else 9999,
    )
    if not sticker_files:
        errors.append("no PNG files in assets/stickers/")
        return print_report(errors)

    numbers = [int(p.stem) for p in sticker_files if p.stem.isdigit()]
    if len(numbers) != len(sticker_files):
        errors.append("sticker filenames must be numeric (01.png, 02.png, ...)")
    elif numbers != list(range(1, len(numbers) + 1)):
        errors.append("sticker numbers must be contiguous starting at 01")

    count = len(sticker_files)
    if count not in ALLOWED_COUNTS:
        errors.append(f"sticker count must be one of {sorted(ALLOWED_COUNTS)}, got {count}")

    for sticker_path in sticker_files:
        errors.extend(check_file(sticker_path, None, STICKER_MAX))

    return print_report(errors)


def print_report(errors: list[str]) -> int:
    if errors:
        print("VALIDATION FAILED")
        for item in errors:
            print(f"  - {item}")
        return 1
    print("OK — assets meet static sticker guidelines")
    return 0


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("assets")
    if not root.is_dir():
        print(f"Directory not found: {root}")
        sys.exit(2)
    sys.exit(validate(root))


if __name__ == "__main__":
    main()
