#!/usr/bin/env python3
"""
CLI for ChatGPT Sticker Sheet Converter V2 (additive).

Examples:
  python convert.py --sheet path/to/sheet.png --out output/my-set
  python convert.py --input input/ --output output/ --zip
  python convert.py --self-check
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_PKG_DIR = Path(__file__).resolve().parent
_PARENT = _PKG_DIR.parent
if str(_PARENT) not in sys.path:
    sys.path.insert(0, str(_PARENT))

from sheet_converter_v2.pipeline import ConvertOptions, convert_batch, convert_sheet


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "V2 smart sticker sheet converter (flood-fill + histogram cuts). "
            "Additive — does not replace TypeScript chroma/slice algorithms."
        )
    )
    parser.add_argument("--sheet", type=Path, help="Single sticker sheet image")
    parser.add_argument("--out", type=Path, help="Output folder for single-sheet mode")
    parser.add_argument("--input", type=Path, help="Batch input folder of sheets")
    parser.add_argument("--output", type=Path, help="Batch output folder (set1/, set2/, …)")
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=5)
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument(
        "--equal-grid",
        action="store_true",
        help="Use equal cell bounds instead of projection-histogram cuts",
    )
    parser.add_argument("--no-line-fit", action="store_true", help="Skip 370×320 fit")
    parser.add_argument("--zip", action="store_true", help="Write stickers_v2.zip in batch mode")
    parser.add_argument("--self-check", action="store_true", help="Run synthetic self-check and exit")
    return parser


def run_self_check() -> int:
    from sheet_converter_v2.background import estimate_background_rgb, flood_fill_background_mask
    from sheet_converter_v2.export import fit_line_sticker
    from sheet_converter_v2.grid_cut import detect_grid_cuts
    import numpy as np

    rgb = np.full((200, 200, 3), 243, dtype=np.uint8)
    for y0, x0 in ((20, 20), (20, 120), (120, 20), (120, 120)):
        rgb[y0 : y0 + 40, x0 : x0 + 40] = (30, 80, 200)
    estimate = estimate_background_rgb(rgb)
    assert abs(estimate.rgb[0] - 243) < 8
    mask = flood_fill_background_mask(rgb, estimate)
    assert mask[0, 0]
    assert not mask[30, 30]

    alpha = np.where(mask, 0, 255).astype(np.uint8)
    cuts = detect_grid_cuts(alpha, cols=2, rows=2)
    assert len(cuts.x_bounds) == 3 and len(cuts.y_bounds) == 3

    rgba = np.dstack([rgb, alpha])
    fitted = fit_line_sticker(rgba)
    assert fitted.shape[1] <= 370 and fitted.shape[0] <= 320
    print("sheet_converter_v2 self-check OK")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.self_check:
        return run_self_check()

    options = ConvertOptions(
        cols=args.cols,
        rows=args.rows,
        use_histogram_cuts=not args.equal_grid,
        fit_line_spec=not args.no_line_fit,
        start_index=args.start_index,
    )

    if args.sheet:
        if not args.out:
            print("--out is required with --sheet", file=sys.stderr)
            return 2
        result = convert_sheet(args.sheet, args.out, options)
        print(
            f"V2: {result.sheet_path.name} → {len(result.sticker_paths)} stickers "
            f"(bg≈{result.bg_rgb}, tol={result.bg_tolerance:.1f}) → {result.out_dir}"
        )
        return 0

    if args.input:
        output = args.output or (args.input.parent / "output")
        results = convert_batch(args.input, output, options, make_zip=args.zip)
        total = sum(len(r.sticker_paths) for r in results)
        print(f"V2 batch: {len(results)} sheets → {total} stickers → {output}")
        return 0

    build_parser().print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
