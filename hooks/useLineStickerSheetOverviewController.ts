import { useCallback, useMemo } from 'react';
import type { LineStickerSetOverviewItem } from '../components/LineSticker/LineStickerSetOverviewPanel';
import type { LineStickerSheetStatus } from './useLineStickerSheetGeneration';
import { useLineStickerPromptPreview } from './useLineStickerPromptPreview';
import {
  LINE_STICKER_SHEET_INDICES,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';
import { summarizeSheetPrompt } from '../utils/lineStickerSetModeFactories';

/**
 * Builds the three-sheet progress cards and keeps prompt preview navigation
 * coupled to selecting a sheet. It is display coordination, not generation.
 */
export function useLineStickerSheetOverviewController({
  stickerSetMode,
  currentSheetIndex,
  setCurrentSheetIndex,
  setPhrasesList,
  actionDescsList,
  buildPrompt,
  setError,
  sheetStatuses,
  emptyPromptSummary,
}: {
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  setCurrentSheetIndex: (index: LineStickerSheetIndex) => void;
  setPhrasesList: string[];
  actionDescsList: string[];
  buildPrompt: (phrases?: string[], actionDescs?: string[]) => string;
  setError: (value: string | null) => void;
  sheetStatuses: LineStickerSheetStatus[];
  emptyPromptSummary: string;
}) {
  const promptPreview = useLineStickerPromptPreview({
    stickerSetMode,
    currentSheetIndex,
    setPhrasesList,
    actionDescsList,
    buildPrompt,
    setError,
  });
  const { showPromptPreviewForSheet } = promptPreview;

  const handleSelectOverviewSheet = useCallback((sheetIndex: LineStickerSheetIndex) => {
    setCurrentSheetIndex(sheetIndex);
    showPromptPreviewForSheet(sheetIndex);
  }, [setCurrentSheetIndex, showPromptPreviewForSheet]);

  const sheetOverviewItems = useMemo<LineStickerSetOverviewItem[]>(() => {
    if (!stickerSetMode) return [];

    return LINE_STICKER_SHEET_INDICES.map((sheetIndex) => {
      const phrases = sliceLineStickerSheetFrames(setPhrasesList, sheetIndex);
      const actionDescs = sliceLineStickerSheetFrames(actionDescsList, sheetIndex);
      const hasPromptContent = [...phrases, ...actionDescs].some((entry) => entry.trim().length > 0);
      const status = sheetStatuses.find((entry) => entry.sheetIndex === sheetIndex);

      return {
        sheetIndex,
        promptSummary: hasPromptContent
          ? summarizeSheetPrompt(buildPrompt(phrases, actionDescs))
          : emptyPromptSummary,
        hasPromptContent,
        progress: status?.progress ?? 0,
        stage: status?.stage ?? 'idle',
        message: status?.message ?? '',
        error: status?.error ?? null,
      };
    });
  }, [actionDescsList, buildPrompt, emptyPromptSummary, setPhrasesList, sheetStatuses, stickerSetMode]);

  return { ...promptPreview, handleSelectOverviewSheet, sheetOverviewItems };
}
