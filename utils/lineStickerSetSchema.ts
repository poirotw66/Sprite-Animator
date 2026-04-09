import { DEFAULT_SLICE_SETTINGS } from './constants';
import type { SliceSettings } from './imageUtils';

export const LINE_STICKER_SET_SCHEMA = {
  sheetIndices: [0, 1, 2] as const,
  cols: 4,
  rows: 4,
} as const;

export const LINE_STICKER_SHEET_INDICES = LINE_STICKER_SET_SCHEMA.sheetIndices;
export type LineStickerSheetIndex = (typeof LINE_STICKER_SHEET_INDICES)[number];

export const LINE_STICKER_SHEET_COUNT = LINE_STICKER_SHEET_INDICES.length;
export const LINE_STICKER_SET_COLS = LINE_STICKER_SET_SCHEMA.cols;
export const LINE_STICKER_SET_ROWS = LINE_STICKER_SET_SCHEMA.rows;
export const LINE_STICKER_FRAMES_PER_SHEET = LINE_STICKER_SET_COLS * LINE_STICKER_SET_ROWS;
export const LINE_STICKER_TOTAL_SET_FRAMES =
  LINE_STICKER_SHEET_COUNT * LINE_STICKER_FRAMES_PER_SHEET;
export const DEFAULT_LINE_STICKER_SHEET_INDEX: LineStickerSheetIndex =
  LINE_STICKER_SHEET_INDICES[0];

export interface LineStickerSetTextParams {
  sheetCount: number;
  cols: number;
  rows: number;
  framesPerSheet: number;
  totalFrames: number;
}

export const LINE_STICKER_SET_TEXT_PARAMS: LineStickerSetTextParams = {
  sheetCount: LINE_STICKER_SHEET_COUNT,
  cols: LINE_STICKER_SET_COLS,
  rows: LINE_STICKER_SET_ROWS,
  framesPerSheet: LINE_STICKER_FRAMES_PER_SHEET,
  totalFrames: LINE_STICKER_TOTAL_SET_FRAMES,
};

export function formatLineStickerSetText(
  template: string,
  extraParams?: Partial<Record<keyof LineStickerSetTextParams, string | number>>
): string {
  const params: Record<string, string | number> = {
    ...LINE_STICKER_SET_TEXT_PARAMS,
    ...extraParams,
  };

  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function createLineStickerSheetArray<T>(
  factory: (sheetIndex: LineStickerSheetIndex) => T
): T[] {
  return LINE_STICKER_SHEET_INDICES.map(factory);
}

export function getLineStickerFrameRange(sheetIndex: LineStickerSheetIndex) {
  const start = sheetIndex * LINE_STICKER_FRAMES_PER_SHEET;
  return {
    start,
    end: start + LINE_STICKER_FRAMES_PER_SHEET,
  };
}

export function sliceLineStickerSheetFrames<T>(values: T[], sheetIndex: LineStickerSheetIndex): T[] {
  const { start, end } = getLineStickerFrameRange(sheetIndex);
  return values.slice(start, end);
}

export function createLineStickerSetSliceSettings(): SliceSettings {
  return {
    ...DEFAULT_SLICE_SETTINGS,
    cols: LINE_STICKER_SET_COLS,
    rows: LINE_STICKER_SET_ROWS,
    sliceMode: 'equal',
    inferredCellRects: undefined,
  };
}