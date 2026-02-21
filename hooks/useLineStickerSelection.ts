import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface UseLineStickerSelectionParams {
  stickerSetMode: boolean;
  currentSheetIndex: 0 | 1 | 2;
  sheetFrames: string[][];
  stickerFrames: string[];
  selectedFramesBySheet: boolean[][];
  selectedFrames: boolean[];
  setSelectedFramesBySheet: Dispatch<SetStateAction<boolean[][]>>;
  setSelectedFrames: Dispatch<SetStateAction<boolean[]>>;
}

export function useLineStickerSelection({
  stickerSetMode,
  currentSheetIndex,
  sheetFrames,
  stickerFrames,
  selectedFramesBySheet,
  selectedFrames,
  setSelectedFramesBySheet,
  setSelectedFrames,
}: UseLineStickerSelectionParams) {
  const selectAll = useCallback(() => {
    if (stickerSetMode) {
      setSelectedFramesBySheet((prev) => {
        const next = prev.map((entry) => [...entry]);
        next[currentSheetIndex] = new Array(sheetFrames[currentSheetIndex].length).fill(true);
        return next;
      });
      return;
    }
    setSelectedFrames(new Array(stickerFrames.length).fill(true));
  }, [
    stickerSetMode,
    currentSheetIndex,
    sheetFrames,
    setSelectedFramesBySheet,
    setSelectedFrames,
    stickerFrames.length,
  ]);

  const deselectAll = useCallback(() => {
    if (stickerSetMode) {
      setSelectedFramesBySheet((prev) => {
        const next = prev.map((entry) => [...entry]);
        next[currentSheetIndex] = new Array(sheetFrames[currentSheetIndex].length).fill(
          false
        );
        return next;
      });
      return;
    }
    setSelectedFrames(new Array(stickerFrames.length).fill(false));
  }, [
    stickerSetMode,
    currentSheetIndex,
    sheetFrames,
    setSelectedFramesBySheet,
    setSelectedFrames,
    stickerFrames.length,
  ]);

  const selectedCount = useMemo(() => {
    if (stickerSetMode) {
      return selectedFramesBySheet[currentSheetIndex]?.filter(Boolean).length || 0;
    }
    return selectedFrames.filter(Boolean).length;
  }, [stickerSetMode, selectedFramesBySheet, currentSheetIndex, selectedFrames]);

  const selectedIndices = useMemo(() => {
    return selectedFrames
      .map((selected, index) => (selected ? index : -1))
      .filter((index) => index !== -1);
  }, [selectedFrames]);

  return {
    selectAll,
    deselectAll,
    selectedCount,
    selectedIndices,
  };
}
