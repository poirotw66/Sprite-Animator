/** Grid contract shared by browser jobs and the headless CLI. */
export interface LineStickerSheetLayout {
  cols: number;
  rows: number;
}

export const DEFAULT_LINE_STICKER_SET_COUNT = 40;

export const LINE_STICKER_SET_LAYOUTS = {
  40: [
    { cols: 4, rows: 5 },
    { cols: 4, rows: 5 },
  ],
  48: [
    { cols: 4, rows: 4 },
    { cols: 4, rows: 4 },
    { cols: 4, rows: 4 },
  ],
} as const satisfies Record<number, readonly LineStickerSheetLayout[]>;

export type SupportedLineStickerSetCount = keyof typeof LINE_STICKER_SET_LAYOUTS;

export function isSupportedLineStickerSetCount(value: number): value is SupportedLineStickerSetCount {
  return Object.hasOwn(LINE_STICKER_SET_LAYOUTS, value);
}

export function resolveLineStickerSetLayout(stickerCount: number): LineStickerSheetLayout[] {
  if (!isSupportedLineStickerSetCount(stickerCount)) {
    throw new Error(
      `Unsupported stickerCount ${stickerCount}. Supported: ${Object.keys(LINE_STICKER_SET_LAYOUTS).join(', ')}`,
    );
  }
  return LINE_STICKER_SET_LAYOUTS[stickerCount].map((layout) => ({ ...layout }));
}

export function splitPhrasesAcrossSheets(
  phrases: string[],
  layouts: readonly LineStickerSheetLayout[],
): string[][] {
  let offset = 0;
  return layouts.map(({ cols, rows }) => {
    const count = cols * rows;
    const slice = phrases.slice(offset, offset + count);
    offset += count;
    return slice;
  });
}

export function totalFramesFromLayouts(layouts: readonly LineStickerSheetLayout[]): number {
  return layouts.reduce((sum, { cols, rows }) => sum + cols * rows, 0);
}
