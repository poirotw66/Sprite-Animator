/**
 * Post-chroma repair for Gemini LINE stickers: exterior stroke only.
 * No alpha feather — feathering white borders creates gray halos on dark backgrounds.
 */

import { repairExteriorStrokeHalo } from './solidifyStrokeWhite';
import {
  isStickerStrokeFringe,
  isStickerStrokeWhite,
  shouldPreserveStickerStroke,
} from './stickerStrokeWhite';

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

function hasWhiteStrokeNeighbor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  p: number,
  radius: number = 2
): boolean {
  const x = p % width;
  const y = (p - x) / width;
  const r = Math.max(0, Math.floor(radius));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (readAlpha(data, width, height, nx, ny) <= ALPHA_THRESHOLD) continue;
      const idx = (ny * width + nx) * 4;
      const nr = data[idx]!;
      const ng = data[idx + 1]!;
      const nb = data[idx + 2]!;
      if (isStickerStrokeWhite(nr, ng, nb) || isStickerStrokeFringe(nr, ng, nb)) return true;
    }
  }
  return false;
}

function isExteriorDarkHalo(r: number, g: number, b: number): boolean {
  const lum = (r + g + b) / 3;
  return lum < 110 && !shouldPreserveStickerStroke(r, g, b);
}

function hasInteriorSubjectNeighbor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  p: number
): boolean {
  const x = p % width;
  const y = (p - x) / width;
  for (const [dx, dy] of [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]) {
    if (readAlpha(data, width, height, dx, dy) <= ALPHA_THRESHOLD) continue;
    const idx = (dy * width + dx) * 4;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    if (shouldPreserveStickerStroke(r, g, b)) continue;
    if (!isExteriorDarkHalo(r, g, b)) return true;
  }
  return false;
}

/** Erase dark residue sandwiched between exterior transparency and the white stroke ring. */
function clearExteriorDarkHaloRing(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const total = width * height;
  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    if (data[idx + 3]! <= ALPHA_THRESHOLD) continue;
    if (!touchesTransparent(data, width, height, p)) continue;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    if (shouldPreserveStickerStroke(r, g, b)) continue;
    if (!isExteriorDarkHalo(r, g, b)) continue;
    if (!hasWhiteStrokeNeighbor(data, width, height, p)) continue;
    if (hasInteriorSubjectNeighbor(data, width, height, p)) continue;
    data[idx + 3] = 0;
  }
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

  clearExteriorDarkHaloRing(data, width, height);
  repairExteriorStrokeHalo(data, width, height, 1);
}
