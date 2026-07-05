/** LINE Creators Market custom sticker image requirements (upload ZIP). */

export const LINE_STICKER_UPLOAD = {
  stickerMaxWidth: 370,
  stickerMaxHeight: 320,
  mainSize: 240,
  tabWidth: 96,
  tabHeight: 74,
  maxFileBytes: 1_000_000,
  maxZipBytes: 20_000_000,
  supportedStickerCounts: [8, 16, 24, 32, 40] as const,
} as const;

export type LineUploadStickerCount = (typeof LINE_STICKER_UPLOAD.supportedStickerCounts)[number];

export function toEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

export function computeFitDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: toEvenDimension(width * scale),
    height: toEvenDimension(height * scale),
  };
}

export function isLineUploadStickerCount(count: number): count is LineUploadStickerCount {
  return (LINE_STICKER_UPLOAD.supportedStickerCounts as readonly number[]).includes(count);
}

export function resolveLineUploadStickerCount(
  producedCount: number,
  preferredCount?: number
): LineUploadStickerCount {
  if (preferredCount != null && isLineUploadStickerCount(preferredCount)) {
    if (preferredCount <= producedCount) {
      return preferredCount;
    }
    throw new Error(
      `lineUploadStickerCount ${preferredCount} exceeds produced stickers (${producedCount})`
    );
  }

  if (isLineUploadStickerCount(producedCount)) {
    return producedCount;
  }

  if (producedCount > 40) {
    return 40;
  }

  throw new Error(
    `Cannot build LINE upload pack: produced ${producedCount} stickers. ` +
      `LINE supports ${LINE_STICKER_UPLOAD.supportedStickerCounts.join(', ')} per set.`
  );
}

export function lineUploadStickerFileName(index: number): string {
  return `${String(index).padStart(2, '0')}.png`;
}
