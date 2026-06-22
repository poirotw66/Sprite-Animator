import {
  LINE_STICKER_SHEET_INDICES,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from './lineStickerSetSchema';
import type { ProgrammaticTextOverlayTuning } from './lineStickerTextOverlay';

export interface OverlayStyleDigestInput {
  selectedFont: string;
  selectedTextColor: string;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
}

export function digestOverlayStyle(style: OverlayStyleDigestInput): string {
  return JSON.stringify(style);
}

export function digestPhrasesForSheet(
  phrases: string[],
  sheetIndex: LineStickerSheetIndex
): string {
  return sliceLineStickerSheetFrames(phrases, sheetIndex).join('\u0001');
}

export interface OverlayComposePlanItem {
  sheetIndex: LineStickerSheetIndex;
  useFullRes: boolean;
}

export function planOverlayComposeSheets(params: {
  dirtySheets: ReadonlySet<LineStickerSheetIndex>;
  fullResPendingSheets: ReadonlySet<LineStickerSheetIndex>;
  currentSheetIndex: LineStickerSheetIndex;
  sheetsWithRaw: ReadonlySet<LineStickerSheetIndex>;
}): OverlayComposePlanItem[] {
  const { dirtySheets, fullResPendingSheets, currentSheetIndex, sheetsWithRaw } = params;
  const plan: OverlayComposePlanItem[] = [];

  for (const sheetIndex of LINE_STICKER_SHEET_INDICES) {
    if (!dirtySheets.has(sheetIndex) || !sheetsWithRaw.has(sheetIndex)) {
      continue;
    }
    const useFullRes =
      sheetIndex === currentSheetIndex || fullResPendingSheets.has(sheetIndex);
    plan.push({ sheetIndex, useFullRes });
  }

  plan.sort((left, right) => {
    if (left.sheetIndex === currentSheetIndex) {
      return -1;
    }
    if (right.sheetIndex === currentSheetIndex) {
      return 1;
    }
    return left.sheetIndex - right.sheetIndex;
  });

  return plan;
}

export function collectSheetsWithRaw(
  rawBySheet: ReadonlyArray<string[] | null>
): Set<LineStickerSheetIndex> {
  const sheets = new Set<LineStickerSheetIndex>();
  for (const sheetIndex of LINE_STICKER_SHEET_INDICES) {
    const raw = rawBySheet[sheetIndex];
    if (raw && raw.length > 0) {
      sheets.add(sheetIndex);
    }
  }
  return sheets;
}

export function collectSheetsNeedingFullRes(params: {
  sheetsWithRaw: ReadonlySet<LineStickerSheetIndex>;
  fullResSheets: ReadonlySet<LineStickerSheetIndex>;
}): LineStickerSheetIndex[] {
  return LINE_STICKER_SHEET_INDICES.filter(
    (sheetIndex) =>
      params.sheetsWithRaw.has(sheetIndex) && !params.fullResSheets.has(sheetIndex)
  );
}
