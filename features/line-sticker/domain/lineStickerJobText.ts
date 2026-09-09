/**
 * Job-owned text state for set-mode LINE sticker packs.
 * Flat UI lists are projections of per-sheet phrases/actions.
 */
import {
  DEFAULT_BROWSER_LINE_STICKER_SET_COUNT,
  createLineStickerJobSheets,
  type LineStickerJobSheet,
} from './lineStickerJob';
import {
  LINE_STICKER_FRAMES_PER_SHEET,
  LINE_STICKER_SHEET_INDICES,
  LINE_STICKER_TOTAL_SET_FRAMES,
  getLineStickerFrameRange,
  type LineStickerSheetIndex,
} from '../../../utils/lineStickerSetSchema';

export interface LineStickerJobTextSheet {
  phrases: string[];
  actionDescriptions: string[];
}

export type LineStickerJobTextState = LineStickerJobTextSheet[];

export function createLineStickerJobTextState(
  stickerCount: typeof DEFAULT_BROWSER_LINE_STICKER_SET_COUNT = DEFAULT_BROWSER_LINE_STICKER_SET_COUNT,
): LineStickerJobTextState {
  return createLineStickerJobSheets(stickerCount).map(() => ({
    phrases: Array.from({ length: LINE_STICKER_FRAMES_PER_SHEET }, () => ''),
    actionDescriptions: Array.from({ length: LINE_STICKER_FRAMES_PER_SHEET }, () => ''),
  }));
}

export function flattenJobTextValues(
  state: LineStickerJobTextState,
  pick: 'phrases' | 'actionDescriptions',
): string[] {
  const values = Array.from({ length: LINE_STICKER_TOTAL_SET_FRAMES }, () => '');
  for (const sheetIndex of LINE_STICKER_SHEET_INDICES) {
    const sheet = state[sheetIndex];
    if (!sheet) continue;
    const { start } = getLineStickerFrameRange(sheetIndex);
    sheet[pick].forEach((value, offset) => {
      if (offset < LINE_STICKER_FRAMES_PER_SHEET) values[start + offset] = value;
    });
  }
  return values;
}

export function applyFlatValuesToJobTextState(
  state: LineStickerJobTextState,
  pick: 'phrases' | 'actionDescriptions',
  flatValues: readonly string[],
): LineStickerJobTextState {
  return LINE_STICKER_SHEET_INDICES.map((sheetIndex) => {
    const current = state[sheetIndex] ?? {
      phrases: Array.from({ length: LINE_STICKER_FRAMES_PER_SHEET }, () => ''),
      actionDescriptions: Array.from({ length: LINE_STICKER_FRAMES_PER_SHEET }, () => ''),
    };
    const { start, end } = getLineStickerFrameRange(sheetIndex);
    const nextValues = flatValues.slice(start, end);
    while (nextValues.length < LINE_STICKER_FRAMES_PER_SHEET) nextValues.push('');
    return {
      ...current,
      [pick]: nextValues.slice(0, LINE_STICKER_FRAMES_PER_SHEET),
    };
  });
}

export function jobTextStateFromJobSheets(sheets: readonly LineStickerJobSheet[]): LineStickerJobTextState {
  const base = createLineStickerJobTextState();
  for (const sheet of sheets) {
    const sheetIndex = sheet.index as LineStickerSheetIndex;
    if (!LINE_STICKER_SHEET_INDICES.includes(sheetIndex)) continue;
    base[sheetIndex] = {
      phrases: [
        ...sheet.phrases,
        ...Array.from({ length: Math.max(0, LINE_STICKER_FRAMES_PER_SHEET - sheet.phrases.length) }, () => ''),
      ].slice(0, LINE_STICKER_FRAMES_PER_SHEET),
      actionDescriptions: [
        ...(sheet.actionDescriptions ?? []),
        ...Array.from(
          { length: Math.max(0, LINE_STICKER_FRAMES_PER_SHEET - (sheet.actionDescriptions?.length ?? 0)) },
          () => '',
        ),
      ].slice(0, LINE_STICKER_FRAMES_PER_SHEET),
    };
  }
  return base;
}

export function applyJobTextStateToSheets(
  sheets: LineStickerJobSheet[],
  textState: LineStickerJobTextState,
): LineStickerJobSheet[] {
  return sheets.map((sheet, index) => {
    const text = textState[index];
    if (!text) return sheet;
    const actions = text.actionDescriptions;
    return {
      ...sheet,
      phrases: [...text.phrases],
      ...(actions.some((value) => value.trim().length > 0)
        ? { actionDescriptions: [...actions] }
        : { actionDescriptions: undefined }),
    };
  });
}
