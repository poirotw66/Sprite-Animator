"""Export LINE-sized transparent PNGs and optional ZIP."""

from __future__ import annotations

import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

from . import LINE_STICKER_MAX_HEIGHT, LINE_STICKER_MAX_WIDTH


def _even(value: int) -> int:
    rounded = max(2, int(round(value)))
    return rounded if rounded % 2 == 0 else rounded - 1


def fit_line_sticker(rgba: np.ndarray) -> np.ndarray:
    """Scale to fit within 370×320 with even dimensions (LINE upload spec)."""
    height, width = rgba.shape[:2]
    if width <= 0 or height <= 0:
        return rgba
    scale = min(LINE_STICKER_MAX_WIDTH / width, LINE_STICKER_MAX_HEIGHT / height, 1.0)
    new_w = _even(width * scale)
    new_h = _even(height * scale)
    if new_w == width and new_h == height:
        return rgba
    img = Image.fromarray(rgba, mode="RGBA")
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return np.asarray(resized)


def save_png(path: Path, rgba: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, format="PNG", optimize=True)


def write_zip(zip_path: Path, files: list[Path], *, arc_prefix: str = "") -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            arcname = f"{arc_prefix}{file_path.name}" if arc_prefix else file_path.name
            zf.write(file_path, arcname=arcname)
