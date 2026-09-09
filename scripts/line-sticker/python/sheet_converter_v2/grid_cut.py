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
    # Half-width of the low-density band around each internal x seam (index 1..cols-1).
    x_band_half: tuple[int, ...] = ()
    # Half-width of the low-density band around each internal y seam (index 1..rows-1).
    y_band_half: tuple[int, ...] = ()


def _smooth(profile: np.ndarray, radius: int = 3) -> np.ndarray:
    if radius <= 0:
        return profile
    kernel = np.ones(radius * 2 + 1, dtype=np.float64)
    kernel /= kernel.sum()
    padded = np.pad(profile.astype(np.float64), radius, mode="edge")
    return np.convolve(padded, kernel, mode="valid").astype(np.float32)


def _content_profiles(alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    # Soft anti-aliased outline fringes (alpha ~40–80) should read as gutter,
    # not solid content — otherwise near-touching stickers have no valley.
    hard = (alpha > 96).astype(np.float32)
    soft = ((alpha > 40) & (alpha <= 96)).astype(np.float32) * 0.25
    content = hard + soft
    col_density = content.mean(axis=0)
    row_density = content.mean(axis=1)
    return _smooth(col_density), _smooth(row_density)


def _valley_band(
    density: np.ndarray,
    pos: int,
    *,
    soft_thr: float,
) -> tuple[int, int]:
    """Expand a contiguous low-density band around pos (inclusive lo/hi)."""
    n = len(density)
    pos = int(np.clip(pos, 0, n - 1))
    dens0 = float(density[pos])
    # High-density positions are not gutters — keep a 1px "band".
    if dens0 > soft_thr * 2.5:
        return pos, pos
    # Expand only through similarly empty samples; never walk up into art.
    floor = dens0 + 0.012
    expand_cap = max(soft_thr * 1.6, dens0 + 0.02)
    lo = pos
    while lo > 0:
        prev = float(density[lo - 1])
        if prev > floor or prev > expand_cap:
            break
        lo -= 1
    hi = pos
    while hi < n - 1:
        nxt = float(density[hi + 1])
        if nxt > floor or nxt > expand_cap:
            break
        hi += 1
    return lo, hi


def _is_local_min(density: np.ndarray, pos: int, *, radius: int = 3) -> bool:
    n = len(density)
    lo = max(0, pos - radius)
    hi = min(n, pos + radius + 1)
    value = float(density[pos])
    return value <= float(np.min(density[lo:hi])) + 1e-6


def _find_seams(
    density: np.ndarray,
    expected_cuts: int,
    size: int,
    *,
    search_ratio: float = 0.28,
    soft_thr: float = 0.08,
) -> tuple[list[int], list[int]]:
    """
    Find internal seams near equal-split positions.

    Prefers the center of the widest low-density valley (true gutter), not the
    raw argmin of a soft anti-aliased dip that still sits on sticker outlines.
    Returns (bounds, band_half_widths_for_internal_seams).
    """
    bounds = [0]
    band_halves: list[int] = []
    cell = size / (expected_cuts + 1)
    radius = max(12, int(cell * search_ratio))

    for i in range(1, expected_cuts + 1):
        theoretical = int(round(i * size / (expected_cuts + 1)))
        lo = max(bounds[-1] + 8, theoretical - radius)
        hi = min(size - 8, theoretical + radius)
        if hi <= lo:
            bounds.append(theoretical)
            band_halves.append(0)
            continue

        best_pos = theoretical
        best_score = float("inf")
        best_band = (theoretical, theoretical)

        for pos in range(lo, hi + 1):
            dens = float(density[pos])
            band_lo, band_hi = _valley_band(density, pos, soft_thr=soft_thr)
            # Keep the band inside the search window so neighbor cuts stay stable.
            band_lo = max(band_lo, lo)
            band_hi = min(band_hi, hi)
            width = max(1, band_hi - band_lo + 1)
            dist_pen = 0.012 * abs(pos - theoretical) / max(radius, 1)
            # Wide empty gutters win; soft AA dips through outlines lose.
            width_bonus = 0.045 * min(width, 48) / 48.0
            local_bonus = 0.02 if _is_local_min(density, pos, radius=4) else 0.0
            empty_bonus = 0.03 if dens <= soft_thr * 0.5 else 0.0
            score = dens + dist_pen - width_bonus - local_bonus - empty_bonus
            if score < best_score:
                best_score = score
                best_pos = pos
                best_band = (band_lo, band_hi)

        band_lo, band_hi = best_band
        # Snap to the geometric center of the winning valley band.
        snapped = int(round((band_lo + band_hi) / 2))
        snapped = int(np.clip(snapped, lo, hi))
        # If the band is tiny / soft, keep the densest-minimum position instead
        # of drifting toward a band edge that still sits on content.
        if band_hi - band_lo < 3:
            snapped = best_pos
        bounds.append(snapped)
        band_halves.append(max(0, (band_hi - band_lo) // 2))

    bounds.append(size)

    min_cell = max(20, size // ((expected_cuts + 1) * 4))
    for i in range(1, len(bounds) - 1):
        bounds[i] = max(
            bounds[i - 1] + min_cell,
            min(bounds[i], size - (len(bounds) - 1 - i) * min_cell),
        )
    bounds[-1] = size
    return bounds, band_halves


def _median_int(values: list[int]) -> int:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[mid]
    return int(round((ordered[mid - 1] + ordered[mid]) / 2))


def detect_grid_cuts(
    alpha: np.ndarray,
    cols: int = 4,
    rows: int = 5,
) -> GridCuts:
    height, width = alpha.shape
    col_density, row_density = _content_profiles(alpha)
    x_bounds, x_band_half = _find_seams(col_density, cols - 1, width)

    # Row seams: detect per column (handles art that bridges the gutter at
    # column centers), then take the median so warped rows stay stable.
    y_per_column: list[list[int]] = []
    y_band_samples: list[list[int]] = [[] for _ in range(rows - 1)]
    for col in range(cols):
        x0 = x_bounds[col]
        x1 = x_bounds[col + 1]
        local_hard = (alpha[:, x0:x1] > 96).astype(np.float32)
        local_soft = ((alpha[:, x0:x1] > 40) & (alpha[:, x0:x1] <= 96)).astype(np.float32) * 0.25
        local = _smooth((local_hard + local_soft).mean(axis=1))
        y_bounds_col, y_bands_col = _find_seams(local, rows - 1, height)
        y_per_column.append(y_bounds_col)
        for seam_i, half in enumerate(y_bands_col):
            y_band_samples[seam_i].append(half)

    y_bounds = [0]
    for seam_i in range(1, rows):
        samples = [col_bounds[seam_i] for col_bounds in y_per_column]
        y_bounds.append(_median_int(samples))
    y_bounds.append(height)

    min_cell = max(20, height // (rows * 4))
    for i in range(1, len(y_bounds) - 1):
        y_bounds[i] = max(
            y_bounds[i - 1] + min_cell,
            min(y_bounds[i], height - (len(y_bounds) - 1 - i) * min_cell),
        )
    y_bounds[-1] = height

    # Global row profile band widths as a fallback blend with per-column.
    _, global_y_bands = _find_seams(row_density, rows - 1, height)
    y_band_half: list[int] = []
    for seam_i in range(rows - 1):
        samples = y_band_samples[seam_i] + [global_y_bands[seam_i]]
        y_band_half.append(_median_int(samples))

    return GridCuts(
        x_bounds=x_bounds,
        y_bounds=y_bounds,
        cols=cols,
        rows=rows,
        x_band_half=tuple(x_band_half),
        y_band_half=tuple(y_band_half),
    )


def equal_grid_cuts(width: int, height: int, cols: int, rows: int) -> GridCuts:
    x_bounds = [int(round(i * width / cols)) for i in range(cols + 1)]
    y_bounds = [int(round(i * height / rows)) for i in range(rows + 1)]
    return GridCuts(
        x_bounds=x_bounds,
        y_bounds=y_bounds,
        cols=cols,
        rows=rows,
        x_band_half=tuple(0 for _ in range(cols - 1)),
        y_band_half=tuple(0 for _ in range(rows - 1)),
    )


def _seam_inset(band_half: int, *, max_inset: int) -> int:
    """
    Only inset into confirmed gutter. Soft-touch seams (band≈0) get zero inset
    so we do not carve into white outlines that already touch the valley.
    """
    if max_inset <= 0 or band_half <= 1:
        return 0
    # Leave at least 1px of gutter on the seam side; never exceed max_inset.
    return int(min(max_inset, max(0, band_half - 1)))


def inset_cell_rect(
    cuts: GridCuts,
    col: int,
    row: int,
    *,
    inset: int = 2,
) -> tuple[int, int, int, int]:
    """
    Build a per-cell rect.

    Inset is adaptive per shared seam: wide empty gutters keep a small shrink to
    avoid neighbor AA bleed; near-touching soft valleys keep inset=0 so artwork
    outlines are not sliced off.
    """
    x0 = cuts.x_bounds[col]
    x1 = cuts.x_bounds[col + 1]
    y0 = cuts.y_bounds[row]
    y1 = cuts.y_bounds[row + 1]
    if inset <= 0:
        return x0, y0, x1, y1

    left_inset = 0
    right_inset = 0
    top_inset = 0
    bottom_inset = 0

    if col > 0:
        band = cuts.x_band_half[col - 1] if col - 1 < len(cuts.x_band_half) else 0
        left_inset = _seam_inset(band, max_inset=inset)
    if col < cuts.cols - 1:
        band = cuts.x_band_half[col] if col < len(cuts.x_band_half) else 0
        right_inset = _seam_inset(band, max_inset=inset)
    if row > 0:
        band = cuts.y_band_half[row - 1] if row - 1 < len(cuts.y_band_half) else 0
        top_inset = _seam_inset(band, max_inset=inset)
    if row < cuts.rows - 1:
        band = cuts.y_band_half[row] if row < len(cuts.y_band_half) else 0
        bottom_inset = _seam_inset(band, max_inset=inset)

    x0 += left_inset
    x1 -= right_inset
    y0 += top_inset
    y1 -= bottom_inset

    if x1 <= x0 + 4:
        x0, x1 = cuts.x_bounds[col], cuts.x_bounds[col + 1]
    if y1 <= y0 + 4:
        y0, y1 = cuts.y_bounds[row], cuts.y_bounds[row + 1]
    return x0, y0, x1, y1
