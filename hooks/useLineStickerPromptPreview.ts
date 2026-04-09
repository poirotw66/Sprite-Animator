import { useCallback, useState } from 'react';
import {
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';

interface UseLineStickerPromptPreviewParams {
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  setPhrasesList: string[];
  actionDescsList: string[];
  buildPrompt: (phraseListOverride?: string[], actionDescsOverride?: string[]) => string;
  setError: (value: string | null) => void;
}

export function useLineStickerPromptPreview({
  stickerSetMode,
  currentSheetIndex,
  setPhrasesList,
  actionDescsList,
  buildPrompt,
  setError,
}: UseLineStickerPromptPreviewParams) {
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  const showPromptPreviewForSheet = useCallback((sheetIndex?: LineStickerSheetIndex) => {
    const targetSheetIndex = sheetIndex ?? currentSheetIndex;
    const phraseList = stickerSetMode
      ? sliceLineStickerSheetFrames(setPhrasesList, targetSheetIndex)
      : undefined;
    const actionDescs = stickerSetMode
      ? sliceLineStickerSheetFrames(actionDescsList, targetSheetIndex)
      : undefined;
    const prompt = buildPrompt(phraseList, actionDescs);
    setPreviewPrompt(prompt);
    setError(null);
    return prompt;
  }, [
    stickerSetMode,
    setPhrasesList,
    currentSheetIndex,
    actionDescsList,
    buildPrompt,
    setError,
  ]);

  const handleGeneratePromptPreview = useCallback(() => {
    showPromptPreviewForSheet(currentSheetIndex);
  }, [currentSheetIndex, showPromptPreviewForSheet]);

  const handleCopyPrompt = useCallback(() => {
    if (!previewPrompt) return;
    navigator.clipboard.writeText(previewPrompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  }, [previewPrompt]);

  return {
    previewPrompt,
    promptCopied,
    handleGeneratePromptPreview,
    showPromptPreviewForSheet,
    handleCopyPrompt,
  };
}
