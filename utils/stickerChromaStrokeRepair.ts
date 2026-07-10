/**
 * Post-chroma repair for Gemini LINE stickers: exterior stroke only.
 * No alpha feather — feathering white borders creates gray halos on dark backgrounds.
 */

import { repairExteriorStrokeHalo } from './solidifyStrokeWhite';
import { shouldPreserveStickerStroke } from './stickerStrokeWhite';

const ALPHA_THRESHOLD = 24;

function readAlpha(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return data[(y * width + x) * 4 + 3]!;
}

function touchesTransparent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  p: number
): boolean {
  const x = p % width;
  const y = (p - x) / width;
  return (
    readAlpha(data, width, height, x - 1, y) <= ALPHA_THRESHOLD ||
    readAlpha(data, width, height, x + 1, y) <= ALPHA_THRESHOLD ||
    readAlpha(data, width, height, x, y - 1) <= ALPHA_THRESHOLD ||
    readAlpha(data, width, height, x, y + 1) <= ALPHA_THRESHOLD
  );
}

function hasOpaqueNeighbor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  p: number
): boolean {
  const x = p % width;
  const y = (p - x) / width;
  for (const [nx, ny] of [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]) {
    if (readAlpha(data, width, height, nx, ny) > ALPHA_THRESHOLD) return true;
  }
  return false;
}

/** Restore exterior stroke fringe and whiten the outer halo. Mutates RGBA in place. */
export function repairStickerStrokeAfterChromaKey(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const total = width * height;

  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    if (data[idx + 3]! > 0) continue;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    if (!shouldPreserveStickerStroke(r, g, b)) continue;
    if (!touchesTransparent(data, width, height, p)) continue;
    if (!hasOpaqueNeighbor(data, width, height, p)) continue;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }

  repairExteriorStrokeHalo(data, width, height, 1);
}
