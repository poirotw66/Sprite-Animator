/**
 * Factory helpers for LINE sticker "set mode" per-sheet state arrays, plus a
 * small prompt summarizer. Pure module-level helpers extracted from
 * LineStickerPage so the page component holds wiring, not boilerplate.
 */

import { FrameOverride, SliceSettings } from './imageUtils';
import {
  createLineStickerSetSliceSettings,
  createLineStickerSheetArray,
} from './lineStickerSetSchema';

export const createSetModeSliceSettingsList = (): SliceSettings[] =>
  createLineStickerSheetArray(() => createLineStickerSetSliceSettings());

export const createEmptySetModeImageList = (): (string | null)[] =>
  createLineStickerSheetArray(() => null);

export const createEmptySetModeFrameList = (): string[][] =>
  createLineStickerSheetArray(() => []);

export const createEmptySetModeOverrideList = (): FrameOverride[][] =>
  createLineStickerSheetArray(() => []);

export const createEmptySetModeSelectionList = (): boolean[][] =>
  createLineStickerSheetArray(() => []);

/** Compact one-line summary of a sheet prompt for the set overview cards. */
export function summarizeSheetPrompt(prompt: string): string {
  const cellLines = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('**Cell '))
    .slice(0, 2);
  const source = cellLines.length > 0 ? cellLines.join(' ') : prompt;
  const compact = source.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}
