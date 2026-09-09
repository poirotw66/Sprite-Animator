/**
 * Job-owned image slots for set-mode LINE sticker packs.
 * Flat workspace arrays are projections of per-sheet generated/processed/frames.
 */
import type { LineStickerJobSheet } from './lineStickerJob';
import {
  LINE_STICKER_SHEET_COUNT,
  LINE_STICKER_SHEET_INDICES,
  type LineStickerSheetIndex,
} from '../../../utils/lineStickerSetSchema';

export interface LineStickerJobImageSheet {
  generated: string | null;
  processed: string | null;
  frames: string[];
}

export type LineStickerJobImageState = LineStickerJobImageSheet[];

export function createLineStickerJobImageState(): LineStickerJobImageState {
  return Array.from({ length: LINE_STICKER_SHEET_COUNT }, () => ({
    generated: null,
    processed: null,
    frames: [],
  }));
}

export function flattenJobImageGenerated(state: LineStickerJobImageState): (string | null)[] {
  return LINE_STICKER_SHEET_INDICES.map((index) => state[index]?.generated ?? null);
}

export function flattenJobImageProcessed(state: LineStickerJobImageState): (string | null)[] {
  return LINE_STICKER_SHEET_INDICES.map((index) => state[index]?.processed ?? null);
}

export function flattenJobImageFrames(state: LineStickerJobImageState): string[][] {
  return LINE_STICKER_SHEET_INDICES.map((index) => [...(state[index]?.frames ?? [])]);
}

export function applyGeneratedListToJobImageState(
  state: LineStickerJobImageState,
  images: readonly (string | null)[],
): LineStickerJobImageState {
  return LINE_STICKER_SHEET_INDICES.map((index) => ({
    ...(state[index] ?? { generated: null, processed: null, frames: [] }),
    generated: images[index] ?? null,
  }));
}

export function applyProcessedListToJobImageState(
  state: LineStickerJobImageState,
  images: readonly (string | null)[],
): LineStickerJobImageState {
  return LINE_STICKER_SHEET_INDICES.map((index) => ({
    ...(state[index] ?? { generated: null, processed: null, frames: [] }),
    processed: images[index] ?? null,
  }));
}

export function applyFramesListToJobImageState(
  state: LineStickerJobImageState,
  framesBySheet: readonly (readonly string[])[],
): LineStickerJobImageState {
  return LINE_STICKER_SHEET_INDICES.map((index) => ({
    ...(state[index] ?? { generated: null, processed: null, frames: [] }),
    frames: [...(framesBySheet[index] ?? [])],
  }));
}

export function jobImageStateFromJobSheets(
  sheets: readonly LineStickerJobSheet[],
  resolved: {
    generated: readonly (string | null)[];
    processed: readonly (string | null)[];
    frames: readonly (readonly string[])[];
  },
): LineStickerJobImageState {
  const base = createLineStickerJobImageState();
  for (const sheet of sheets) {
    const sheetIndex = sheet.index as LineStickerSheetIndex;
    if (!LINE_STICKER_SHEET_INDICES.includes(sheetIndex)) continue;
    base[sheetIndex] = {
      generated: resolved.generated[sheetIndex] ?? null,
      processed: resolved.processed[sheetIndex] ?? null,
      frames: [...(resolved.frames[sheetIndex] ?? [])],
    };
  }
  return base;
}

export function hasJobImageArtifacts(state: LineStickerJobImageState): boolean {
  return state.some((sheet) => Boolean(sheet.generated || sheet.processed || sheet.frames.length > 0));
}
