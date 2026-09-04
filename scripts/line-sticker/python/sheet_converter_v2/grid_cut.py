"""Projection-histogram grid cutting for fixed cols×rows sticker sheets."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class GridCuts:
    x_bounds: list[int]
    y_bounds: list[int]
    cols: int
    rows: int


def _smooth(profile: np.ndarray, radius: int = 3) -> np.ndarray:
    if radius <= 0:
        return profile
    kernel = np.ones(radius * 2 + 1, dtype=np.float64)
    kernel /= kernel.sum()
    padded = np.pad(profile.astype(np.float64), radius, mode="edge")
    return np.convolve(padded, kernel, mode="valid").astype(np.float32)


def _content_profiles(alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    content = (alpha > 32).astype(np.float32)
    col_density = content.mean(axis=0)
    row_density = content.mean(axis=1)
    return _smooth(col_density), _smooth(row_density)


def _find_seams(
    density: np.ndarray,
    expected_cuts: int,
    size: int,
    *,
    search_ratio: float = 0.22,
) -> list[int]:
    """
    Find internal seams near equal-split positions.

    Prefers the lowest-density valley, with a small distance penalty so thin
    gutters win over cutting through sticker content.
    """
    bounds = [0]
    cell = size / (expected_cuts + 1)
    radius = max(10, int(cell * search_ratio))
    for i in range(1, expected_cuts + 1):
        theoretical = int(round(i * size / (expected_cuts + 1)))
        lo = max(bounds[-1] + 6, theoretical - radius)
        hi = min(size - 6, theoretical + radius)
        if hi <= lo:
            bounds.append(theoretical)
            continue
        window = density[lo : hi + 1]
        offsets = np.arange(lo, hi + 1, dtype=np.float32)
        dist_pen = 0.015 * np.abs(offsets - theoretical) / max(radius, 1)
        scores = window + dist_pen
        local = int(lo + int(np.argmin(scores)))
        bounds.append(local)
    bounds.append(size)

    min_cell = max(20, size // ((expected_cuts + 1) * 4))
    for i in range(1, len(bounds) - 1):
        bounds[i] = max(
            bounds[i - 1] + min_cell,
            min(bounds[i], size - (len(bounds) - 1 - i) * min_cell),
        )
    bounds[-1] = size
    return bounds


def detect_grid_cuts(
    alpha: np.ndarray,
    cols: int = 4,
    rows: int = 5,
) -> GridCuts:
    height, width = alpha.shape
    col_density, row_density = _content_profiles(alpha)
    x_bounds = _find_seams(col_density, cols - 1, width)
    y_bounds = _find_seams(row_density, rows - 1, height)
    return GridCuts(x_bounds=x_bounds, y_bounds=y_bounds, cols=cols, rows=rows)


def equal_grid_cuts(width: int, height: int, cols: int, rows: int) -> GridCuts:
    x_bounds = [int(round(i * width / cols)) for i in range(cols + 1)]
    y_bounds = [int(round(i * height / rows)) for i in range(rows + 1)]
    return GridCuts(x_bounds=x_bounds, y_bounds=y_bounds, cols=cols, rows=rows)


def inset_cell_rect(
    cuts: GridCuts,
    col: int,
    row: int,
    *,
    inset: int = 2,
) -> tuple[int, int, int, int]:
    """Build a per-cell rect, shrinking shared seams so neighbors don't overlap."""
    x0 = cuts.x_bounds[col]
    x1 = cuts.x_bounds[col + 1]
    y0 = cuts.y_bounds[row]
    y1 = cuts.y_bounds[row + 1]
    if inset <= 0:
        return x0, y0, x1, y1
    if col > 0:
        x0 += inset
    if col < cuts.cols - 1:
        x1 -= inset
    if row > 0:
        y0 += inset
    if row < cuts.rows - 1:
        y1 -= inset
    if x1 <= x0 + 4:
        x0, x1 = cuts.x_bounds[col], cuts.x_bounds[col + 1]
    if y1 <= y0 + 4:
        y0, y1 = cuts.y_bounds[row], cuts.y_bounds[row + 1]
    return x0, y0, x1, y1
