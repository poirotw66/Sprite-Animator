/**
 * Soften sticker silhouettes by blurring alpha on the exterior boundary only.
 * RGB unchanged; interior white stroke stays fully opaque.
 */

import { isStickerStrokeWhite } from './stickerStrokeWhite';

export interface AlphaEdgeFeatherOptions {
  /**
   * Morphological erosion before blur. Default 0 — erosion thins/breaks thin white strokes.
   */
  erodePx?: number;
  /** Box-blur radius in px on the 1px exterior band only. Default 1. */
  blurRadiusPx?: number;
  /** Pixels with alpha <= this count as transparent for boundary detection. Default 24. */
  alphaThreshold?: number;
}

function readAlphaAt(
  alpha: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return alpha[y * width + x]!;
}

function readDataAlpha(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return data[(y * width + x) * 4 + 3]!;
}

function erodeAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  iterations: number
): Uint8Array {
  let current = alpha;
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(current);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let minA = current[i]!;
        minA = Math.min(minA, readAlphaAt(current, width, height, x - 1, y));
        minA = Math.min(minA, readAlphaAt(current, width, height, x + 1, y));
        minA = Math.min(minA, readAlphaAt(current, width, height, x, y - 1));
        minA = Math.min(minA, readAlphaAt(current, width, height, x, y + 1));
        next[i] = minA;
      }
    }
    current = next;
  }
  return current;
}

function boxBlurAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const r = Math.max(1, radius);
  const kernel = r * 2 + 1;
  const temp = new Float32Array(width * height);
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let dx = -r; dx <= r; dx++) {
      sum += readAlphaAt(alpha, width, height, dx, y);
    }
    for (let x = 0; x < width; x++) {
      temp[y * width + x] = sum / kernel;
      sum -= readAlphaAt(alpha, width, height, x - r, y);
      sum += readAlphaAt(alpha, width, height, x + r + 1, y);
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let dy = -r; dy <= r; dy++) {
      sum += temp[dy * width + x] ?? 0;
    }
    for (let y = 0; y < height; y++) {
      const i = y * width + x;
      out[i] = Math.round(Math.min(255, Math.max(0, sum / kernel)));
      sum -= temp[(y - r) * width + x] ?? 0;
      sum += temp[(y + r + 1) * width + x] ?? 0;
    }
  }

  return out;
}

function markExteriorBoundary(
  alpha: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): Uint8Array {
  const total = width * height;
  const exterior = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    if (alpha[p]! <= alphaThreshold) continue;
    const x = p % width;
    const y = (p - x) / width;
    const touchesTransparent =
      readAlphaAt(alpha, width, height, x - 1, y) <= alphaThreshold ||
      readAlphaAt(alpha, width, height, x + 1, y) <= alphaThreshold ||
      readAlphaAt(alpha, width, height, x, y - 1) <= alphaThreshold ||
      readAlphaAt(alpha, width, height, x, y + 1) <= alphaThreshold;
    if (touchesTransparent) exterior[p] = 1;
  }
  return exterior;
}

function restoreInteriorStrokeWhite(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): void {
  const total = width * height;
  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    const a = data[idx + 3]!;
    if (!isStickerStrokeWhite(r, g, b) || a >= 255) continue;

    const x = p % width;
    const y = (p - x) / width;
    const touchesTransparent =
      readDataAlpha(data, width, height, x - 1, y) <= alphaThreshold ||
      readDataAlpha(data, width, height, x + 1, y) <= alphaThreshold ||
      readDataAlpha(data, width, height, x, y - 1) <= alphaThreshold ||
      readDataAlpha(data, width, height, x, y + 1) <= alphaThreshold;
    if (!touchesTransparent) data[idx + 3] = 255;
  }
}

/**
 * Mutates `data` (RGBA): blurs alpha on the exterior boundary only. RGB unchanged.
 */
export function featherAlphaEdge(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options?: AlphaEdgeFeatherOptions
): void {
  if (width <= 0 || height <= 0) return;

  const erodePx = Math.max(0, Math.floor(options?.erodePx ?? 0));
  const blurRadiusPx = Math.max(0, Math.floor(options?.blurRadiusPx ?? 1));
  const alphaThreshold = options?.alphaThreshold ?? 24;
  const total = width * height;
  const alpha = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    alpha[p] = data[p * 4 + 3]!;
  }

  let working = erodePx > 0 ? erodeAlpha(alpha, width, height, erodePx) : alpha;
  if (blurRadiusPx <= 0) {
    for (let p = 0; p < total; p++) data[p * 4 + 3] = working[p]!;
    return;
  }

  const exterior = markExteriorBoundary(working, width, height, alphaThreshold);
  const blurred = boxBlurAlpha(working, width, height, blurRadiusPx);

  for (let p = 0; p < total; p++) {
    data[p * 4 + 3] = exterior[p] ? blurred[p]! : working[p]!;
  }

  restoreInteriorStrokeWhite(data, width, height, alphaThreshold);
}
