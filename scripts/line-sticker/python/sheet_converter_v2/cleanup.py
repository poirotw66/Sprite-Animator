"""Edge decontamination and morphological alpha cleanup."""

from __future__ import annotations

import numpy as np


def decontaminate_edges(
    rgba: np.ndarray,
    bg_rgb: tuple[int, int, int],
    *,
    radius: int = 2,
) -> np.ndarray:
    """
    Soften bg-tinted fringe near transparency: pull RGB away from bg and fade alpha.
    Preserves saturated subject colors (text / sparks / ink).
    """
    out = rgba.copy()
    alpha = out[:, :, 3]
    rgb = out[:, :, :3].astype(np.float32)
    br, bg, bb = (float(bg_rgb[0]), float(bg_rgb[1]), float(bg_rgb[2]))

    # Edge = opaque pixel with a transparent neighbor within radius
    transparent = alpha < 16
    near_edge = np.zeros_like(transparent)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dy == 0 and dx == 0:
                continue
            shifted = np.roll(np.roll(transparent, dy, axis=0), dx, axis=1)
            near_edge |= shifted

    fringe = near_edge & (alpha > 16) & (alpha < 250)
    if not np.any(fringe):
        return out

    subject = rgb[fringe]
    dist = np.sqrt(
        (subject[:, 0] - br) ** 2 + (subject[:, 1] - bg) ** 2 + (subject[:, 2] - bb) ** 2
    )
    # Only decontaminate pixels still close to paper color
    close = dist < 70.0
    if not np.any(close):
        return out

    idx = np.where(fringe)
    keep = close
    ys = idx[0][keep]
    xs = idx[1][keep]
    pixels = rgb[ys, xs]
    # Blend toward subject by subtracting residual bg tint
    strength = np.clip(1.0 - dist[keep] / 70.0, 0.15, 0.85)[:, None]
    cleaned = pixels + (pixels - np.array([br, bg, bb], dtype=np.float32)) * strength * 0.55
    cleaned = np.clip(cleaned, 0, 255)
    rgb[ys, xs] = cleaned
    # Slightly reduce alpha on heavily tinted fringe
    alpha_adj = out[:, :, 3].astype(np.float32)
    alpha_adj[ys, xs] = np.minimum(alpha_adj[ys, xs], 255.0 * (1.0 - 0.25 * strength[:, 0]))
    out[:, :, :3] = rgb.astype(np.uint8)
    out[:, :, 3] = np.clip(alpha_adj, 0, 255).astype(np.uint8)
    return out


def _dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    padded = np.pad(mask, radius, mode="constant", constant_values=False)
    out = mask.copy()
    height, width = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            shifted = padded[
                radius + dy : radius + dy + height,
                radius + dx : radius + dx + width,
            ]
            out |= shifted
    return out


def _erode(mask: np.ndarray, radius: int) -> np.ndarray:
    padded = np.pad(mask, radius, mode="constant", constant_values=True)
    out = mask.copy()
    height, width = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            shifted = padded[
                radius + dy : radius + dy + height,
                radius + dx : radius + dx + width,
            ]
            out &= shifted
    return out


def morphological_close_alpha(
    alpha: np.ndarray,
    *,
    kernel: int = 3,
    iterations: int = 1,
) -> np.ndarray:
    """
    Binary closing on alpha mask to reconnect thin strokes (sweat, motion lines).
    Small kernel only — large kernels would glue neighboring stickers.
    """
    mask = alpha > 32
    radius = max(1, kernel // 2)
    closed = mask.copy()
    for _ in range(max(1, iterations)):
        closed = _erode(_dilate(closed, radius), radius)

    out = alpha.copy()
    # Only fill newly closed gaps that were near-zero (don't inflate solid regions)
    fill = closed & (alpha < 32)
    out[fill] = 220
    return out
