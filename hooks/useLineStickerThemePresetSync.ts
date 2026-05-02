import { useEffect } from 'react';
import {
  THEME_PRESETS,
  expandThemePhrasesForFrames,
  getActionHint,
  type ThemeOption,
} from '../utils/lineStickerPrompt';
import { LINE_STICKER_TOTAL_SET_FRAMES } from '../utils/lineStickerSetSchema';

interface UseLineStickerThemePresetSyncParams {
  selectedTheme: ThemeOption;
  gridCols: number;
  gridRows: number;
  setSinglePhrasesList: (value: string[]) => void;
  setSetPhrasesList: (value: string[]) => void;
  setActionDescsList: (value: string[]) => void;
}

export function useLineStickerThemePresetSync({
  selectedTheme,
  gridCols,
  gridRows,
  setSinglePhrasesList,
  setSetPhrasesList,
  setActionDescsList,
}: UseLineStickerThemePresetSyncParams) {
  useEffect(() => {
    if (selectedTheme === 'custom') return;
    const theme = THEME_PRESETS[selectedTheme];
    if (!theme) return;

    const singleTotal = Math.max(1, gridCols * gridRows);
    const expandedSingle = expandThemePhrasesForFrames(theme, singleTotal);
    const expandedSet = expandThemePhrasesForFrames(theme, LINE_STICKER_TOTAL_SET_FRAMES);
    const actionLen = Math.max(singleTotal, LINE_STICKER_TOTAL_SET_FRAMES);
    const expandedForActions = expandThemePhrasesForFrames(theme, actionLen);

    setSinglePhrasesList(expandedSingle);
    setSetPhrasesList(expandedSet);
    setActionDescsList(expandedForActions.map((phrase) => getActionHint(phrase)));
  }, [
    selectedTheme,
    gridCols,
    gridRows,
    setSinglePhrasesList,
    setSetPhrasesList,
    setActionDescsList,
  ]);
}
