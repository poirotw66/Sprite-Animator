/** Bright low-saturation pixels used as Gemini sticker outer stroke (white on green). */
export function isStickerStrokeWhite(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 180 && max >= 200 && max - min < 80;
}

/**
 * Green-tinted JPEG fringe between pure white stroke and chroma background.
 * Must survive chroma key and skip despill / pass-4c graying.
 */
export function isStickerStrokeFringe(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const spread = max - min;
  if (max < 150 || min < 70 || spread >= 110) return false;
  if (g - Math.max(r, b) >= 45) return false;
  return min >= 140 && max >= 165 && g >= r - 35 && g >= b - 35;
}

export function shouldPreserveStickerStroke(r: number, g: number, b: number): boolean {
  return isStickerStrokeWhite(r, g, b) || isStickerStrokeFringe(r, g, b);
}
