"""V2 sheet conversion pipeline (additive — does not call TS chroma/slice)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .background import estimate_background_rgb, flood_fill_background_mask
from .cleanup import decontaminate_edges, morphological_close_alpha
from .components import CellRect, extract_cell_with_components
from .export import fit_line_sticker, save_png, write_zip
from .grid_cut import detect_grid_cuts, equal_grid_cuts


@dataclass(frozen=True)
class ConvertOptions:
    cols: int = 4
    rows: int = 5
    use_histogram_cuts: bool = True
    margin_ratio: float = 0.04
    morph_kernel: int = 3
    fit_line_spec: bool = True
    start_index: int = 1


@dataclass
class ConvertResult:
    sheet_path: Path
    out_dir: Path
    sticker_paths: list[Path]
    bg_rgb: tuple[int, int, int]
    bg_tolerance: float


def load_rgba(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGBA")
    return np.asarray(image).copy()


def key_sheet(rgba: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int], float]:
    rgb = rgba[:, :, :3]
    estimate = estimate_background_rgb(rgb)
    bg_mask = flood_fill_background_mask(rgb, estimate)
    out = rgba.copy()
    out[bg_mask, 3] = 0
    out[:, :, 3] = morphological_close_alpha(out[:, :, 3], kernel=3, iterations=1)
    out = decontaminate_edges(out, estimate.rgb)
    return out, estimate.rgb, estimate.tolerance


def convert_sheet(
    sheet_path: Path,
    out_dir: Path,
    options: ConvertOptions | None = None,
) -> ConvertResult:
    opts = options or ConvertOptions()
    rgba = load_rgba(sheet_path)
    keyed, bg_rgb, tolerance = key_sheet(rgba)
    height, width = keyed.shape[:2]

    if opts.use_histogram_cuts:
        cuts = detect_grid_cuts(keyed[:, :, 3], cols=opts.cols, rows=opts.rows)
    else:
        cuts = equal_grid_cuts(width, height, opts.cols, opts.rows)

    out_dir.mkdir(parents=True, exist_ok=True)
    sticker_paths: list[Path] = []
    index = opts.start_index

    for row in range(opts.rows):
        for col in range(opts.cols):
            rect = CellRect(
                x0=cuts.x_bounds[col],
                y0=cuts.y_bounds[row],
                x1=cuts.x_bounds[col + 1],
                y1=cuts.y_bounds[row + 1],
            )
            cell = extract_cell_with_components(
                keyed,
                rect,
                margin_ratio=opts.margin_ratio,
            )
            if opts.fit_line_spec:
                cell = fit_line_sticker(cell)
            dest = out_dir / f"{index:02d}.png"
            save_png(dest, cell)
            sticker_paths.append(dest)
            index += 1

    # Debug preview of keyed sheet (does not replace TS _processed-sheet)
    save_png(out_dir / "_v2_keyed_sheet.png", keyed)
    return ConvertResult(
        sheet_path=sheet_path,
        out_dir=out_dir,
        sticker_paths=sticker_paths,
        bg_rgb=bg_rgb,
        bg_tolerance=tolerance,
    )


def convert_batch(
    input_dir: Path,
    output_dir: Path,
    options: ConvertOptions | None = None,
    *,
    make_zip: bool = True,
) -> list[ConvertResult]:
    """
    Process every image in input_dir:
      input/001.png → output/set1/01..20.png
      input/002.png → output/set2/21..40.png  (continuous numbering)
    """
    opts = options or ConvertOptions()
    patterns = ("*.png", "*.jpg", "*.jpeg", "*.webp")
    sheets: list[Path] = []
    for pattern in patterns:
        sheets.extend(sorted(input_dir.glob(pattern)))
    # Deduplicate case-insensitive
    seen: set[str] = set()
    unique: list[Path] = []
    for path in sheets:
        key = path.name.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)

    results: list[ConvertResult] = []
    next_index = opts.start_index
    all_stickers: list[Path] = []

    for set_i, sheet in enumerate(unique, start=1):
        set_dir = output_dir / f"set{set_i}"
        set_opts = ConvertOptions(
            cols=opts.cols,
            rows=opts.rows,
            use_histogram_cuts=opts.use_histogram_cuts,
            margin_ratio=opts.margin_ratio,
            morph_kernel=opts.morph_kernel,
            fit_line_spec=opts.fit_line_spec,
            start_index=next_index,
        )
        result = convert_sheet(sheet, set_dir, set_opts)
        results.append(result)
        all_stickers.extend(result.sticker_paths)
        next_index += opts.cols * opts.rows

    if make_zip and all_stickers:
        write_zip(output_dir / "stickers_v2.zip", all_stickers)

    return results
