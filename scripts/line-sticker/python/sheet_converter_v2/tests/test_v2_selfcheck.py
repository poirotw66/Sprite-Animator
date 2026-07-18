"""
Assert-based self-check for sheet_converter_v2.
Run: python tests/test_v2_selfcheck.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

_PARENT = Path(__file__).resolve().parents[2]
if str(_PARENT) not in sys.path:
    sys.path.insert(0, str(_PARENT))

from sheet_converter_v2.background import estimate_background_rgb, flood_fill_background_mask
from sheet_converter_v2.cleanup import decontaminate_edges, morphological_close_alpha
from sheet_converter_v2.export import fit_line_sticker
from sheet_converter_v2.grid_cut import detect_grid_cuts
from sheet_converter_v2.pipeline import ConvertOptions, convert_sheet


def test_background_flood_fill_keeps_interior_subject() -> None:
    height, width = 120, 120
    rgb = np.full((height, width, 3), 240, dtype=np.uint8)
    rgb[40:80, 40:80] = (20, 40, 200)
    estimate = estimate_background_rgb(rgb)
    mask = flood_fill_background_mask(rgb, estimate)
    assert mask[0, 0]
    assert not mask[60, 60]


def test_histogram_cuts_find_four_cells() -> None:
    height, width = 200, 200
    alpha = np.zeros((height, width), dtype=np.uint8)
    for y0, x0 in ((10, 10), (10, 110), (110, 10), (110, 110)):
        alpha[y0 : y0 + 50, x0 : x0 + 50] = 255
    cuts = detect_grid_cuts(alpha, cols=2, rows=2)
    assert cuts.x_bounds[0] == 0 and cuts.x_bounds[-1] == width
    assert 60 < cuts.x_bounds[1] < 140
    assert 60 < cuts.y_bounds[1] < 140


def test_line_fit_respects_max_box() -> None:
    rgba = np.zeros((500, 500, 4), dtype=np.uint8)
    rgba[:, :, 3] = 255
    fitted = fit_line_sticker(rgba)
    assert fitted.shape[1] <= 370
    assert fitted.shape[0] <= 320
    assert fitted.shape[1] % 2 == 0
    assert fitted.shape[0] % 2 == 0


def test_morph_close_fills_small_gap() -> None:
    alpha = np.zeros((20, 20), dtype=np.uint8)
    alpha[8:12, 2:8] = 255
    alpha[8:12, 12:18] = 255
    closed = morphological_close_alpha(alpha, kernel=5, iterations=1)
    assert closed[10, 10] > 0


def test_decontaminate_processes_opaque_edge() -> None:
    rgba = np.zeros((9, 9, 4), dtype=np.uint8)
    rgba[2:7, 2:7] = (225, 235, 247, 255)
    cleaned = decontaminate_edges(rgba, (230, 238, 249), radius=1)
    assert cleaned[2, 2, 3] < 255
    assert cleaned[4, 4, 3] == 255


def test_convert_sheet_writes_expected_count(tmp_dir: Path) -> None:
    height, width = 400, 400
    rgb = np.full((height, width, 3), 245, dtype=np.uint8)
    for row in range(5):
        for col in range(4):
            y0 = int(row * height / 5) + 8
            x0 = int(col * width / 4) + 8
            rgb[y0 : y0 + 50, x0 : x0 + 60] = (180, 40, 40)
    sheet = tmp_dir / "sheet.png"
    Image.fromarray(rgb, mode="RGB").save(sheet)
    out = tmp_dir / "out"
    result = convert_sheet(sheet, out, ConvertOptions(cols=4, rows=5, fit_line_spec=True))
    assert len(result.sticker_paths) == 20
    assert all(path.exists() for path in result.sticker_paths)


def main() -> None:
    test_background_flood_fill_keeps_interior_subject()
    test_histogram_cuts_find_four_cells()
    test_line_fit_respects_max_box()
    test_morph_close_fills_small_gap()
    test_decontaminate_processes_opaque_edge()
    with tempfile.TemporaryDirectory() as tmp:
        test_convert_sheet_writes_expected_count(Path(tmp))
    print("all v2 self-checks passed")


if __name__ == "__main__":
    main()
