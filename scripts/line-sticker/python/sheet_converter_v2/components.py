"""Connected-component merge and per-cell extraction."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class CellRect:
    x0: int
    y0: int
    x1: int
    y1: int


def _label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4-connected labeling. Returns labels (0=bg) and count."""
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    current = 0
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or labels[y, x] != 0:
                continue
            current += 1
            stack = [(y, x)]
            labels[y, x] = current
            while stack:
                cy, cx = stack.pop()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if ny < 0 or nx < 0 or ny >= height or nx >= width:
                        continue
                    if not mask[ny, nx] or labels[ny, nx] != 0:
                        continue
                    labels[ny, nx] = current
                    stack.append((ny, nx))
    return labels, current


def _touches_crop_border(xs: np.ndarray, ys: np.ndarray, cw: int, ch: int) -> bool:
    return bool(
        np.any(xs <= 0)
        or np.any(xs >= cw - 1)
        or np.any(ys <= 0)
        or np.any(ys >= ch - 1)
    )


def extract_cell_with_components(
    rgba: np.ndarray,
    rect: CellRect,
    *,
    gutter: int = 4,
    min_area: int = 24,
    margin_ratio: float = 0.03,
    ownership_inset: int = 3,
    primary_mass_ratio: float = 0.55,
    satellite_max_area_ratio: float = 0.12,
) -> np.ndarray:
    """
    Crop cell with small gutter, keep the primary in-cell component plus small
    satellites, then trim to content bbox + margin.

    Ownership uses a lighter core inset than before so soft-touch seams (where
    the grid cut already sits on anti-aliased outlines) do not drop the cell's
    own white border. Neighbor skims are still rejected via border + core_ratio.
    """
    height, width, _ = rgba.shape
    gx0 = max(0, rect.x0 - gutter)
    gy0 = max(0, rect.y0 - gutter)
    gx1 = min(width, rect.x1 + gutter)
    gy1 = min(height, rect.y1 + gutter)

    crop = rgba[gy0:gy1, gx0:gx1].copy()
    ch, cw = crop.shape[:2]
    alpha = crop[:, :, 3]
    # Higher threshold breaks weak anti-aliased bridges into neighbor cells.
    mask = alpha > 80
    labels, count = _label_components(mask)

    lx0 = rect.x0 - gx0
    ly0 = rect.y0 - gy0
    lx1 = rect.x1 - gx0
    ly1 = rect.y1 - gy0

    # Soft-touch cells are often only a few px larger than the art; keep the
    # ownership core close to the full rect so outlines near seams survive.
    cell_w = max(1, lx1 - lx0)
    cell_h = max(1, ly1 - ly0)
    inset = min(max(0, ownership_inset), max(1, min(cell_w, cell_h) // 12))
    ox0 = min(lx0 + inset, lx1)
    oy0 = min(ly0 + inset, ly1)
    ox1 = max(lx1 - inset, ox0)
    oy1 = max(ly1 - inset, oy0)
    if ox1 <= ox0 or oy1 <= oy0:
        ox0, oy0, ox1, oy1 = lx0, ly0, lx1, ly1

    candidates: list[tuple[int, int, float, bool, bool, float, float]] = []
    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        area = int(len(xs))
        if area < min_area:
            continue
        in_core = (xs >= ox0) & (xs < ox1) & (ys >= oy0) & (ys < oy1)
        core_ratio = float(np.count_nonzero(in_core)) / float(area)
        # Also measure mass inside the strict cell rect (not only the inset core)
        # so outline pixels that sit in the soft seam still count as owned.
        in_cell = (xs >= lx0) & (xs < lx1) & (ys >= ly0) & (ys < ly1)
        cell_ratio = float(np.count_nonzero(in_cell)) / float(area)
        cx = float(np.mean(xs))
        cy = float(np.mean(ys))
        centroid_in = ox0 <= cx < ox1 and oy0 <= cy < oy1
        centroid_in_cell = lx0 <= cx < lx1 and ly0 <= cy < ly1
        border = _touches_crop_border(xs, ys, cw, ch)
        candidates.append(
            (label, area, max(core_ratio, cell_ratio * 0.92), centroid_in or centroid_in_cell, border, cx, cy)
        )

    if not candidates:
        out = crop.copy()
        keep_mask = np.zeros((ch, cw), dtype=bool)
        keep_mask[ly0:ly1, lx0:lx1] = alpha[ly0:ly1, lx0:lx1] > 40
        out[~keep_mask, 3] = 0
        return _trim_with_margin(out, margin_ratio)

    keep = np.zeros(count + 1, dtype=bool)
    for label, area, core_ratio, centroid_in, border, _cx, _cy in candidates:
        # Keep every component whose mass lives in this cell (text / props /
        # sparkles often sit apart from the character silhouette).
        if centroid_in and core_ratio >= 0.18:
            # Drop skim-in neighbor fragments that mostly live outside.
            if border and core_ratio < 0.45:
                continue
            keep[label] = True
            continue
        if core_ratio >= primary_mass_ratio and not (border and core_ratio < 0.85):
            keep[label] = True

    if not np.any(keep):
        # Fallback: largest candidate
        ranked = sorted(candidates, key=lambda item: item[1], reverse=True)
        keep[ranked[0][0]] = True

    # Drop tiny left/right edge skims (neighbor paws/sparkles that leak across gutters).
    total_kept = sum(area for label, area, *_ in candidates if keep[label])
    for label, area, core_ratio, centroid_in, border, cx, cy in candidates:
        if not keep[label] or not border:
            continue
        if area > max(180, int(total_kept * 0.06)):
            continue
        ys, xs = np.where(labels == label)
        touches_lr = bool(np.any(xs <= 1) or np.any(xs >= cw - 2))
        touches_tb = bool(np.any(ys <= 1) or np.any(ys >= ch - 2))
        side_heavy = cx < cw * 0.14 or cx > cw * 0.86
        if touches_lr and side_heavy and (not touches_tb or core_ratio < 0.55):
            keep[label] = False

    owned = np.isin(labels, np.where(keep)[0])
    # Preserve soft outline AA that labeling (alpha>80) dropped, but only inside
    # the strict cell and only when not already claimed by a kept component's
    # neighborhood — avoids reintroducing neighbor bleed.
    soft = (alpha > 24) & (alpha <= 80)
    soft_in_cell = soft.copy()
    soft_in_cell[:ly0, :] = False
    soft_in_cell[ly1:, :] = False
    soft_in_cell[:, :lx0] = False
    soft_in_cell[:, lx1:] = False
    owned = owned | soft_in_cell

    out = crop.copy()
    out[~owned, 3] = 0
    return _trim_with_margin(out, margin_ratio)


def _trim_with_margin(rgba: np.ndarray, margin_ratio: float) -> np.ndarray:
    ch, cw = rgba.shape[:2]
    ys, xs = np.where(rgba[:, :, 3] > 8)
    if len(xs) == 0:
        return np.zeros((2, 2, 4), dtype=np.uint8)

    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    pad = max(3, int(round(min(cw, ch) * margin_ratio)))
    x0 = max(0, min_x - pad)
    y0 = max(0, min_y - pad)
    x1 = min(cw, max_x + 1 + pad)
    y1 = min(ch, max_y + 1 + pad)
    return rgba[y0:y1, x0:x1]
