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


def _smooth(profile: np.ndarray, radius: int = 2) -> np.ndarray:
    if radius <= 0:
        return profile
    out = np.empty_like(profile)
    for i in range(len(profile)):
        lo = max(0, i - radius)
        hi = min(len(profile), i + radius + 1)
        out[i] = float(np.mean(profile[lo:hi]))
    return out


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
    search_ratio: float = 0.18,
) -> list[int]:
    """Find (expected_cuts) internal seams near equal-split positions (low density)."""
    bounds = [0]
    cell = size / (expected_cuts + 1)
    radius = max(8, int(cell * search_ratio))
    for i in range(1, expected_cuts + 1):
        theoretical = int(round(i * size / (expected_cuts + 1)))
        lo = max(bounds[-1] + 4, theoretical - radius)
        hi = min(size - 4, theoretical + radius)
        window = density[lo : hi + 1]
        if len(window) == 0:
            bounds.append(theoretical)
            continue
        # Prefer lowest content density (gutter / paper gap)
        local = int(lo + int(np.argmin(window)))
        bounds.append(local)
    bounds.append(size)
    # Enforce monotonic + min cell size
    min_cell = max(16, size // ((expected_cuts + 1) * 4))
    for i in range(1, len(bounds) - 1):
        bounds[i] = max(bounds[i - 1] + min_cell, min(bounds[i], size - (len(bounds) - 1 - i) * min_cell))
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
