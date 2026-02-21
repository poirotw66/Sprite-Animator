import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface UseLineStickerPhraseGridParams {
  stickerSetMode: boolean;
  currentSheetIndex: 0 | 1 | 2;
  setPhrasesList: string[];
  setSetPhrasesList: Dispatch<SetStateAction<string[]>>;
  customPhrases: string;
  setCustomPhrases: Dispatch<SetStateAction<string>>;
  actionDescsList: string[];
  setActionDescsList: Dispatch<SetStateAction<string[]>>;
  gridCols: number;
  gridRows: number;
}

const SET_COUNT = 48;
const SHEET_FRAME_COUNT = 16;

function ensureLength(values: string[], size: number): string[] {
  if (values.length >= size) {
    return values.slice(0, size);
  }
  return [...values, ...Array(size - values.length).fill('')];
}

export function useLineStickerPhraseGrid({
  stickerSetMode,
  currentSheetIndex,
  setPhrasesList,
  setSetPhrasesList,
  customPhrases,
  setCustomPhrases,
  actionDescsList,
  setActionDescsList,
  gridCols,
  gridRows,
}: UseLineStickerPhraseGridParams) {
  const phrasesForHook = useMemo(() => {
    if (stickerSetMode) {
      return ensureLength(setPhrasesList, SET_COUNT);
    }
    const total = gridCols * gridRows;
    const fromText = customPhrases.split('\n').map((line) => line.trim());
    return ensureLength(fromText, total);
  }, [stickerSetMode, setPhrasesList, customPhrases, gridCols, gridRows]);

  const actionDescsForHook = useMemo(() => {
    if (stickerSetMode) {
      return ensureLength(actionDescsList, SET_COUNT);
    }
    return ensureLength(actionDescsList, gridCols * gridRows);
  }, [stickerSetMode, actionDescsList, gridCols, gridRows]);

  const phraseGridList = useMemo(() => {
    if (stickerSetMode) {
      const start = currentSheetIndex * SHEET_FRAME_COUNT;
      return ensureLength(
        setPhrasesList.slice(start, start + SHEET_FRAME_COUNT),
        SHEET_FRAME_COUNT
      );
    }
    return phrasesForHook;
  }, [stickerSetMode, currentSheetIndex, setPhrasesList, phrasesForHook]);

  const actionDescGridList = useMemo(() => {
    if (stickerSetMode) {
      const start = currentSheetIndex * SHEET_FRAME_COUNT;
      return ensureLength(
        actionDescsList.slice(start, start + SHEET_FRAME_COUNT),
        SHEET_FRAME_COUNT
      );
    }
    const total = gridCols * gridRows;
    return ensureLength(actionDescsList, total);
  }, [stickerSetMode, currentSheetIndex, actionDescsList, gridCols, gridRows]);

  const updatePhraseAt = useCallback(
    (index: number, value: string) => {
      if (stickerSetMode) {
        const globalIndex = currentSheetIndex * SHEET_FRAME_COUNT + index;
        setSetPhrasesList((prev) => {
          const next = ensureLength(prev, SET_COUNT);
          next[globalIndex] = value;
          return next;
        });
        return;
      }

      const total = gridCols * gridRows;
      const arr = customPhrases.split('\n').map((line) => line.trim());
      const next = ensureLength(arr, total);
      next[index] = value;
      setCustomPhrases(next.join('\n'));
      setSetPhrasesList(next);
    },
    [
      stickerSetMode,
      currentSheetIndex,
      setSetPhrasesList,
      gridCols,
      gridRows,
      customPhrases,
      setCustomPhrases,
    ]
  );

  const updateActionDescAt = useCallback(
    (index: number, value: string) => {
      if (stickerSetMode) {
        const globalIndex = currentSheetIndex * SHEET_FRAME_COUNT + index;
        setActionDescsList((prev) => {
          const next = ensureLength(prev, SET_COUNT);
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
    phraseGridCols: stickerSetMode ? 4 : gridCols,
    phraseGridRows: stickerSetMode ? 4 : gridRows,
    updatePhraseAt,
    updateActionDescAt,
  };
}
