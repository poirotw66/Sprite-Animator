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


def extract_cell_with_components(
    rgba: np.ndarray,
    rect: CellRect,
    *,
    gutter: int = 6,
    min_area: int = 20,
    margin_ratio: float = 0.04,
) -> np.ndarray:
    """
    Crop cell with small gutter, keep components whose mass is mostly in-cell,
    then trim to content bbox + margin. Avoids pulling neighbor stickers.
    """
    height, width, _ = rgba.shape
    gx0 = max(0, rect.x0 - gutter)
    gy0 = max(0, rect.y0 - gutter)
    gx1 = min(width, rect.x1 + gutter)
    gy1 = min(height, rect.y1 + gutter)

    crop = rgba[gy0:gy1, gx0:gx1].copy()
    ch, cw = crop.shape[:2]
    alpha = crop[:, :, 3]
    mask = alpha > 32
    labels, count = _label_components(mask)

    # Local cell coords inside crop
    lx0 = rect.x0 - gx0
    ly0 = rect.y0 - gy0
    lx1 = rect.x1 - gx0
    ly1 = rect.y1 - gy0

    keep = np.zeros(count + 1, dtype=bool)
    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        area = len(xs)
        if area < min_area:
            continue
        in_cell = (
            (xs >= lx0) & (xs < lx1) & (ys >= ly0) & (ys < ly1)
        )
        mass_ratio = float(np.count_nonzero(in_cell)) / float(area)
        cx = float(np.mean(xs))
        cy = float(np.mean(ys))
        centroid_in = lx0 <= cx < lx1 and ly0 <= cy < ly1
        # Keep primary cell mass; also keep small satellites near centroid (sweat/sparks)
        if mass_ratio >= 0.35 or centroid_in:
            keep[label] = True

    owned = np.isin(labels, np.where(keep)[0])
    # Always keep opaque pixels strictly inside cell (anti-aliased text)
    strict = np.zeros((ch, cw), dtype=bool)
    strict[ly0:ly1, lx0:lx1] = alpha[ly0:ly1, lx0:lx1] > 40
    owned |= strict & (labels == 0)

    out = crop.copy()
    out[~owned, 3] = 0

    # Content bbox
    ys, xs = np.where(out[:, :, 3] > 8)
    if len(xs) == 0:
        return np.zeros((2, 2, 4), dtype=np.uint8)

    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    pad = max(4, int(round(min(cw, ch) * margin_ratio)))
    x0 = max(0, min_x - pad)
    y0 = max(0, min_y - pad)
    x1 = min(cw, max_x + 1 + pad)
    y1 = min(ch, max_y + 1 + pad)
    return out[y0:y1, x0:x1]
