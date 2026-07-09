export type ChromaLikeMode = 'normalize' | 'key';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface YCbCr {
  y: number;
  cb: number;
  cr: number;
}

/** Spec defaults; retune only with hard-case tests. */
export const CHROMA_LIKE_NORMALIZE_MAX = 55;
export const CHROMA_LIKE_KEY_MAX = 38;
export const CHROMA_LIKE_SOFT_EXTRA = 12;

/** Avoid divide-by-zero when Y-normalizing near-black pixels. */
const Y_EPS = 1e-6;

/** Maps Y-normalized Cb/Y, Cr/Y ratio deltas back toward Cb/Cr-like units. */
const CHROMA_RATIO_SCALE = 128;

export function rgbToYCbCr(r: number, g: number, b: number): YCbCr {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 0.564 * (b - y);
  const cr = 0.713 * (r - y);
  return { y, cb, cr };
}

/**
 * Brightness-invariant chroma distance: compare Cb/Y and Cr/Y so pure
 * greens at different luminance stay close (raw Cb/Cr scale with Y).
 */
export function chromaDistanceToKey(
  r: number,
  g: number,
  b: number,
  key: RgbColor
): number {
  const p = rgbToYCbCr(r, g, b);
  const k = rgbToYCbCr(key.r, key.g, key.b);
  const pY = Math.max(p.y, Y_EPS);
  const kY = Math.max(k.y, Y_EPS);
  const dCb = p.cb / pY - k.cb / kY;
  const dCr = p.cr / pY - k.cr / kY;
  return Math.hypot(dCb, dCr) * CHROMA_RATIO_SCALE;
}

function keyLooksGreen(key: RgbColor): boolean {
  return key.g >= key.r && key.g >= key.b;
}

function keyLooksMagenta(key: RgbColor): boolean {
  return key.r > 200 && key.b > 200 && key.g < 80;
}

/** Direction gate after distance — blocks skin/gray false positives. */
function passesDirectionGate(r: number, g: number, b: number, key: RgbColor): boolean {
  if (keyLooksGreen(key)) {
    return g > r * 1.05 && g > b * 1.05;
  }
  if (keyLooksMagenta(key)) {
    return r > g * 1.2 && b > g * 1.2 && g < 80 && b <= r + 40;
  }
  // Unknown key: distance-only
  return true;
}

export function isChromaLike(
  r: number,
  g: number,
  b: number,
  key: RgbColor,
  mode: ChromaLikeMode,
  maxDistance?: number
): boolean {
  const limit =
    maxDistance ??
    (mode === 'normalize' ? CHROMA_LIKE_NORMALIZE_MAX : CHROMA_LIKE_KEY_MAX);
  if (chromaDistanceToKey(r, g, b, key) > limit) return false;
  return passesDirectionGate(r, g, b, key);
}

/** Soft-edge band: within key max + soft extra, still chroma-directed. */
export function isChromaSoftEdge(
  r: number,
  g: number,
  b: number,
  key: RgbColor,
  keyMax: number = CHROMA_LIKE_KEY_MAX
): boolean {
  const d = chromaDistanceToKey(r, g, b, key);
  if (d > keyMax + CHROMA_LIKE_SOFT_EXTRA) return false;
  return passesDirectionGate(r, g, b, key);
}

/**
 * Map legacy UI fuzzPercent (0–100) onto a key chroma-distance max.
 * 35% → ~CHROMA_LIKE_KEY_MAX; clamp to a sane band.
 */
export function fuzzPercentToKeyMax(fuzzPercent: number): number {
  const t = Math.max(0, Math.min(100, fuzzPercent)) / 35;
  return Math.max(18, Math.min(70, CHROMA_LIKE_KEY_MAX * t));
}
