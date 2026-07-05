/** Grid size for one Gemini sprite sheet in set mode. */
export interface GridSize {
  cols: number;
  rows: number;
}

/** LINE Creators Market main sticker count. */
export const DEFAULT_LINE_STICKER_SET_COUNT = 40;

/** Supported full-set layouts keyed by total sticker count. */
export const LINE_STICKER_SET_LAYOUTS: Record<number, GridSize[]> = {
  40: [
    { cols: 4, rows: 5 },
    { cols: 4, rows: 5 },
  ],
  48: [
    { cols: 4, rows: 4 },
    { cols: 4, rows: 4 },
    { cols: 4, rows: 4 },
  ],
};

export function resolveSetLayout(stickerCount: number): GridSize[] {
  const layout = LINE_STICKER_SET_LAYOUTS[stickerCount];
  if (!layout) {
    throw new Error(
      `Unsupported stickerCount ${stickerCount}. Supported: ${Object.keys(LINE_STICKER_SET_LAYOUTS).join(', ')}`
    );
  }
  return layout;
}

export function splitPhrasesAcrossSheets(phrases: string[], layouts: GridSize[]): string[][] {
  let offset = 0;
  return layouts.map(({ cols, rows }) => {
    const count = cols * rows;
    const slice = phrases.slice(offset, offset + count);
    offset += count;
    return slice;
  });
}

export function totalFramesFromLayouts(layouts: GridSize[]): number {
  return layouts.reduce((sum, { cols, rows }) => sum + cols * rows, 0);
}
