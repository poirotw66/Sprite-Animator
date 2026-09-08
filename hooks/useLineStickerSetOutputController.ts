import { useCallback, useMemo } from 'react';
import { mergeOptimizedPadding, optimizeSliceSettings, type SliceSettings } from '../utils/imageUtils';
import { LINE_STICKER_SET_COLS, LINE_STICKER_SET_ROWS } from '../utils/lineStickerSetSchema';
import { createLineStickerSetSliceSettings } from '../utils/lineStickerSetSchema';
import { logger } from '../utils/logger';
import { useLineStickerSetOutputState } from './useLineStickerSetOutputState';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';

/** Owns all generated artifacts for the three-sheet set workflow. */
export function useLineStickerSetOutputController() {
  const output = useLineStickerSetOutputState();
  const { currentSheetIndex, setSheetSliceSettings, sheetSliceSettings } = output;
  const currentSetSliceSettings = useMemo(
    () => sheetSliceSettings[currentSheetIndex] ?? createLineStickerSetSliceSettings(),
    [currentSheetIndex, sheetSliceSettings],
  );

  const optimizeSheetSlice = useCallback(async (
    processedImage: string,
    sheetIndex: LineStickerSheetIndex,
  ): Promise<SliceSettings | undefined> => {
    try {
      const optimized = await optimizeSliceSettings(
        processedImage,
        LINE_STICKER_SET_COLS,
        LINE_STICKER_SET_ROWS,
        { conservative: true },
      );
      const merged = mergeOptimizedPadding(optimized);
      let updated: SliceSettings | undefined;
      setSheetSliceSettings((previous) => {
        const next = [...previous];
        const current = next[sheetIndex] ?? createLineStickerSetSliceSettings();
        updated = { ...current, ...merged };
        next[sheetIndex] = updated;
        return next;
      });
      return updated;
    } catch (error: unknown) {
      logger.warn('Auto slice optimization failed for set sheet', sheetIndex, error);
      return undefined;
    }
  }, [setSheetSliceSettings]);

  return { ...output, currentSetSliceSettings, optimizeSheetSlice };
}
