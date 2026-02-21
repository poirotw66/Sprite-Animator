import { useCallback, useState } from 'react';

interface UseLineStickerPromptPreviewParams {
  stickerSetMode: boolean;
  currentSheetIndex: 0 | 1 | 2;
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

  const handleGeneratePromptPreview = useCallback(() => {
    const phraseList = stickerSetMode
      ? setPhrasesList.slice(currentSheetIndex * 16, (currentSheetIndex + 1) * 16)
      : undefined;
    const actionDescs = stickerSetMode
      ? actionDescsList.slice(currentSheetIndex * 16, (currentSheetIndex + 1) * 16)
      : undefined;
    const prompt = buildPrompt(phraseList, actionDescs);
    setPreviewPrompt(prompt);
    setError(null);
  }, [
    stickerSetMode,
    setPhrasesList,
    currentSheetIndex,
    actionDescsList,
    buildPrompt,
    setError,
  ]);

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
    handleCopyPrompt,
  };
}
