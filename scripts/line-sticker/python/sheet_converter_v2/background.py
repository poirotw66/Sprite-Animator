"""Background estimation and flood-fill keying for light paper sheets."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class BackgroundEstimate:
    rgb: tuple[int, int, int]
    tolerance: float


def estimate_background_rgb(
    rgb: np.ndarray,
    *,
    border_px: int = 8,
) -> BackgroundEstimate:
    """Median RGB of border strips — robust for ChatGPT light-paper sheets."""
    height, width, _ = rgb.shape
    band = max(1, min(border_px, height // 8, width // 8))
    samples = np.concatenate(
        [
            rgb[:band, :, :].reshape(-1, 3),
            rgb[-band:, :, :].reshape(-1, 3),
            rgb[:, :band, :].reshape(-1, 3),
            rgb[:, -band:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    median = np.median(samples.astype(np.float64), axis=0)
    rgb_tuple = (int(median[0]), int(median[1]), int(median[2]))
    # ponytail: tolerance scales with how flat the border is; upgrade: K-means multi-bg
    spread = float(np.mean(np.std(samples.astype(np.float64), axis=0)))
    tolerance = float(np.clip(28.0 + spread * 0.8, 24.0, 55.0))
    return BackgroundEstimate(rgb=rgb_tuple, tolerance=tolerance)


def color_distance(rgb: np.ndarray, target: tuple[int, int, int]) -> np.ndarray:
    tr, tg, tb = target
    diff = rgb.astype(np.float32) - np.array([tr, tg, tb], dtype=np.float32)
    return np.sqrt(np.sum(diff * diff, axis=2))


def flood_fill_background_mask(
    rgb: np.ndarray,
    estimate: BackgroundEstimate,
    *,
    seed_border: int = 2,
) -> np.ndarray:
    """
    Return boolean mask where True = background (transparent candidate).
    Seeds from image border; only bg-similar, border-connected pixels are keyed.
    Interior paper pockets inside art are kept (preserves props / speech bubbles).
    """
    height, width, _ = rgb.shape
    dist = color_distance(rgb, estimate.rgb)
    is_bg_like = dist <= estimate.tolerance

    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def try_seed(y: int, x: int) -> None:
        if not is_bg_like[y, x] or visited[y, x]:
            return
        visited[y, x] = True
        queue.append((y, x))

    for x in range(width):
        for y in range(seed_border):
            try_seed(y, x)
            try_seed(height - 1 - y, x)
    for y in range(height):
        for x in range(seed_border):
            try_seed(y, x)
            try_seed(y, width - 1 - x)

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if ny < 0 or nx < 0 or ny >= height or nx >= width:
                continue
            if visited[ny, nx] or not is_bg_like[ny, nx]:
                continue
            visited[ny, nx] = True
            queue.append((ny, nx))

    return visited
