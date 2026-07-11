import type { ChromaKeyColorType } from '../types';

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
  if (colorType === 'magenta') {
    const isPureMagenta = r > 200 && g < 60 && b > 200 && r + b > g * 3;
    const isMagentaScreen = r > 180 && g < 80 && b > 180 && r - g > 120 && b - g > 120;
    const isBrightMagentaScreen = r > 220 && g < 100 && b > 220 && r + b > g * 4;
    const isNeonMagenta = r > 230 && g < 80 && b > 230;
    const distance = Math.hypot(r - targetColor.r, g - targetColor.g, b - targetColor.b);
    return (
      isPureMagenta ||
      isMagentaScreen ||
      isBrightMagentaScreen ||
      isNeonMagenta ||
      distance < tolerance
    );
  }

  const isPureGreen = g > 150 && r < 100 && b < 100;
  const isStandardGreenScreen =
    g > 100 && r < 130 && b < 130 && g > r * 1.2 && g > b * 1.2;
  const isBrightGreenScreen =
    g > 140 && r < 120 && b < 120 && g > r + 40 && g > b + 40;
  const isNeonGreen = g > 180 && r < 100 && b < 100;
  const isGreenVariant = g > 80 && g > r * 1.3 && g > b * 1.3 && r < 150 && b < 150;
  const distance = Math.hypot(r - targetColor.r, g - targetColor.g, b - targetColor.b);
  return (
    isPureGreen ||
    isStandardGreenScreen ||
    isBrightGreenScreen ||
    isNeonGreen ||
    isGreenVariant ||
    distance < tolerance
  );
}

/**
 * Snap chroma-like pixels to the exact target RGB in place (skips fully transparent pixels).
 * Returns how many pixels were rewritten.
 */
/** RGB-heuristic normalizer paired with `processChromaKeyLegacy` (pre-chromaSimilarity). */
export function normalizeChromaBackgroundLegacyInPlace(
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
