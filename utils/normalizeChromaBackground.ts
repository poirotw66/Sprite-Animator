import type { ChromaKeyColorType } from '../types';
import {
  isChromaLike,
  CHROMA_LIKE_NORMALIZE_MAX,
  type RgbColor as SimRgb,
} from './chromaSimilarity';

/** Default RGB distance tolerance (matches browser `normalizeBackgroundColor`). */
export const CHROMA_BACKGROUND_NORMALIZE_TOLERANCE = 100;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * True when a pixel looks like AI-generated chroma background (green or magenta screen).
 * Shared by the web canvas normalizer and the headless LINE sticker skill.
 */
export function isChromaBackgroundPixel(
  r: number,
  g: number,
  b: number,
  colorType: ChromaKeyColorType,
  targetColor: RgbColor,
  tolerance: number = CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
): boolean {
  // Legacy tolerance was RGB Euclidean (~100). Map roughly onto chroma max:
  // when caller passes default 100, use CHROMA_LIKE_NORMALIZE_MAX; otherwise scale.
  const maxDistance =
    tolerance === CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
      ? CHROMA_LIKE_NORMALIZE_MAX
      : Math.max(20, Math.min(80, (tolerance / 100) * CHROMA_LIKE_NORMALIZE_MAX));
  void colorType; // key RGB already encodes green vs magenta
  return isChromaLike(r, g, b, targetColor as SimRgb, 'normalize', maxDistance);
}

/**
 * Snap chroma-like pixels to the exact target RGB in place (skips fully transparent pixels).
 * Returns how many pixels were rewritten.
 */
export function normalizeChromaBackgroundInPlace(
  data: Uint8ClampedArray,
  colorType: ChromaKeyColorType,
  targetColor: RgbColor,
  tolerance: number = CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
): number {
  let normalizedCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a === 0) {
      continue;
    }
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (!isChromaBackgroundPixel(r, g, b, colorType, targetColor, tolerance)) {
      continue;
    }
    data[i] = targetColor.r;
    data[i + 1] = targetColor.g;
    data[i + 2] = targetColor.b;
    normalizedCount++;
  }
  return normalizedCount;
}
