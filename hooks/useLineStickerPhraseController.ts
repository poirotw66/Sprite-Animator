import type { Dispatch, SetStateAction } from 'react';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';
import type { ThemeOption, TEXT_PRESETS } from '../utils/lineStickerPrompt';
import { useLineStickerPhraseGrid } from './useLineStickerPhraseGrid';
import { useLineStickerThemePresetSync } from './useLineStickerThemePresetSync';

/**
 * Keeps phrase editing in sync with the active slice grid and the selected
 * theme. It does not own the design brief or generated output artifacts.
 */
export function useLineStickerPhraseController({
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
  selectedLanguage,
  selectedTheme,
}: {
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
  selectedLanguage: keyof typeof TEXT_PRESETS;
  selectedTheme: ThemeOption;
}) {
  const phraseGrid = useLineStickerPhraseGrid({
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
    selectedLanguage,
  });

  useLineStickerThemePresetSync({
    selectedTheme,
    gridCols,
    gridRows,
    setSinglePhrasesList,
    setSetPhrasesList,
    setActionDescsList,
  });

  return phraseGrid;
}
