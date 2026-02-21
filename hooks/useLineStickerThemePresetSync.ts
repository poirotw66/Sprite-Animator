import { useEffect } from 'react';
import {
  THEME_PRESETS,
  getActionHint,
  type ThemeOption,
} from '../utils/lineStickerPrompt';

interface UseLineStickerThemePresetSyncParams {
  selectedTheme: ThemeOption;
  setCustomPhrases: (value: string) => void;
  setSetPhrasesList: (value: string[]) => void;
  setActionDescsList: (value: string[]) => void;
}

export function useLineStickerThemePresetSync({
  selectedTheme,
  setCustomPhrases,
  setSetPhrasesList,
  setActionDescsList,
}: UseLineStickerThemePresetSyncParams) {
  useEffect(() => {
    if (selectedTheme === 'custom') return;
    const theme = THEME_PRESETS[selectedTheme];
    if (!theme) return;

    setCustomPhrases(theme.examplePhrases.join('\n'));
    setSetPhrasesList(theme.examplePhrases);
    setActionDescsList(theme.examplePhrases.map((phrase) => getActionHint(phrase)));
  }, [selectedTheme, setCustomPhrases, setSetPhrasesList, setActionDescsList]);
}
