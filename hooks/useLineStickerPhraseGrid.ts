import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  LINE_STICKER_FRAMES_PER_SHEET,
  LINE_STICKER_SET_COLS,
  LINE_STICKER_SET_ROWS,
  LINE_STICKER_TOTAL_SET_FRAMES,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';

interface UseLineStickerPhraseGridParams {
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  singlePhrasesList: string[];
  setSinglePhrasesList: Dispatch<SetStateAction<string[]>>;
  setPhrasesList: string[];
  setSetPhrasesList: Dispatch<SetStateAction<string[]>>;
  actionDescsList: string[];
  setActionDescsList: Dispatch<SetStateAction<string[]>>;
  gridCols: number;
  gridRows: number;
}

function ensureLength(values: string[], size: number): string[] {
  if (values.length >= size) {
    return values.slice(0, size);
  }
  return [...values, ...Array(size - values.length).fill('')];
}

export function useLineStickerPhraseGrid({
  stickerSetMode,
  currentSheetIndex,
  singlePhrasesList,
  setSinglePhrasesList,
  setPhrasesList,
  setSetPhrasesList,
  actionDescsList,
  setActionDescsList,
  gridCols,
  gridRows,
}: UseLineStickerPhraseGridParams) {
  const phrasesForHook = useMemo(() => {
    if (stickerSetMode) {
      return ensureLength(setPhrasesList, LINE_STICKER_TOTAL_SET_FRAMES);
    }
    const total = gridCols * gridRows;
    return ensureLength(singlePhrasesList, total);
  }, [stickerSetMode, setPhrasesList, singlePhrasesList, gridCols, gridRows]);

  const actionDescsForHook = useMemo(() => {
    if (stickerSetMode) {
      return ensureLength(actionDescsList, LINE_STICKER_TOTAL_SET_FRAMES);
    }
    return ensureLength(actionDescsList, gridCols * gridRows);
  }, [stickerSetMode, actionDescsList, gridCols, gridRows]);

  const phraseGridList = useMemo(() => {
    if (stickerSetMode) {
      return ensureLength(
        sliceLineStickerSheetFrames(setPhrasesList, currentSheetIndex),
        LINE_STICKER_FRAMES_PER_SHEET
      );
    }
    return phrasesForHook;
  }, [stickerSetMode, currentSheetIndex, setPhrasesList, phrasesForHook]);

  const actionDescGridList = useMemo(() => {
    if (stickerSetMode) {
      return ensureLength(
        sliceLineStickerSheetFrames(actionDescsList, currentSheetIndex),
        LINE_STICKER_FRAMES_PER_SHEET
      );
    }
    const total = gridCols * gridRows;
    return ensureLength(actionDescsList, total);
  }, [stickerSetMode, currentSheetIndex, actionDescsList, gridCols, gridRows]);

  const updatePhraseAt = useCallback(
    (index: number, value: string) => {
      if (stickerSetMode) {
        const globalIndex = currentSheetIndex * LINE_STICKER_FRAMES_PER_SHEET + index;
        setSetPhrasesList((prev) => {
          const next = ensureLength(prev, LINE_STICKER_TOTAL_SET_FRAMES);
          next[globalIndex] = value;
          return next;
        });
        return;
      }

      const total = gridCols * gridRows;
      setSinglePhrasesList((prev) => {
        const next = ensureLength(prev, total);
        next[index] = value;
        return next;
      });
    },
    [
      stickerSetMode,
      currentSheetIndex,
      setSetPhrasesList,
      gridCols,
      gridRows,
      setSinglePhrasesList,
    ]
  );

  const updateActionDescAt = useCallback(
    (index: number, value: string) => {
      if (stickerSetMode) {
        const globalIndex = currentSheetIndex * LINE_STICKER_FRAMES_PER_SHEET + index;
        setActionDescsList((prev) => {
          const next = ensureLength(prev, LINE_STICKER_TOTAL_SET_FRAMES);
          next[globalIndex] = value;
          return next;
        });
        return;
      }

      const total = gridCols * gridRows;
      setActionDescsList((prev) => {
        const next = ensureLength(prev, total);
        next[index] = value;
        return next;
      });
    },
    [stickerSetMode, currentSheetIndex, setActionDescsList, gridCols, gridRows]
  );

  return {
    phrasesForHook,
    actionDescsForHook,
    phraseGridList,
    actionDescGridList,
    phraseGridCols: stickerSetMode ? LINE_STICKER_SET_COLS : gridCols,
    phraseGridRows: stickerSetMode ? LINE_STICKER_SET_ROWS : gridRows,
    updatePhraseAt,
    updateActionDescAt,
  };
}
