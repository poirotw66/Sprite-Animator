import { useCallback, useState } from 'react';
import { getErrorMessage } from '../types/errors';
import { generateActionDescriptions, generateStickerPhrases } from '../services/geminiService';
import {
  getActionHint,
  TEXT_PRESETS,
  THEME_PRESETS,
  type ThemeOption,
} from '../utils/lineStickerPrompt';
import { logger } from '../utils/logger';
import { LINE_STICKER_TOTAL_SET_FRAMES } from '../utils/lineStickerSetSchema';

interface PhraseGenerationTexts {
  errorApiKey: string;
}

interface UseLineStickerPhraseGenerationParams {
  getEffectiveApiKey: () => string;
  setError: (value: string | null) => void;
  setShowSettings: (value: boolean) => void;
  stickerSetMode: boolean;
  gridCols: number;
  gridRows: number;
  selectedTheme: ThemeOption;
  customThemeContext: string;
  selectedLanguage: keyof typeof TEXT_PRESETS;
  setSinglePhrasesList: (value: string[]) => void;
  setSetPhrasesList: (value: string[]) => void;
  setActionDescsList: (value: string[]) => void;
  t: PhraseGenerationTexts;
}

export function useLineStickerPhraseGeneration({
  getEffectiveApiKey,
  setError,
  setShowSettings,
  stickerSetMode,
  gridCols,
  gridRows,
  selectedTheme,
  customThemeContext,
  selectedLanguage,
  setSinglePhrasesList,
  setSetPhrasesList,
  setActionDescsList,
  t,
}: UseLineStickerPhraseGenerationParams) {
  const [isGeneratingPhrases, setIsGeneratingPhrases] = useState(false);

  const buildFullContext = useCallback((): string => {
    const themeInfo =
      selectedTheme === 'custom'
        ? customThemeContext?.trim() || 'Custom theme'
        : `${THEME_PRESETS[selectedTheme].label} (${THEME_PRESETS[selectedTheme].chatContext})`;

    const blocks = ['Character/style: From uploaded reference image only (no preset).', `Theme: ${themeInfo}`];
    return blocks.join('\n');
  }, [
    selectedTheme,
    customThemeContext,
  ]);

  const handleGeneratePhrases = useCallback(async () => {
    const key = getEffectiveApiKey();
    if (!key) {
      setError(t.errorApiKey);
      setShowSettings(true);
      return;
    }

    setIsGeneratingPhrases(true);
    try {
      const count = stickerSetMode ? LINE_STICKER_TOTAL_SET_FRAMES : gridCols * gridRows;
      const fullContext = buildFullContext();
      const langLabel = TEXT_PRESETS[selectedLanguage]?.label || selectedLanguage;
      const examplePhrases =
        selectedTheme === 'custom' ? [] : THEME_PRESETS[selectedTheme].examplePhrases;

      const phrases = await generateStickerPhrases(
        key,
        fullContext,
        langLabel,
        count,
        undefined,
        examplePhrases
      );
      if (stickerSetMode) {
        setSetPhrasesList(phrases);
      } else {
        setSinglePhrasesList(phrases);
      }

      try {
        const actionDescs = await generateActionDescriptions(key, phrases);
        setActionDescsList(actionDescs);
      } catch (actionErr: unknown) {
        logger.warn(
          'Action descriptions fallback to getActionHint:',
          getErrorMessage(actionErr)
        );
        setActionDescsList(phrases.map((phrase) => getActionHint(phrase)));
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (msg.includes('API Key is missing')) {
        setError(t.errorApiKey);
        setShowSettings(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsGeneratingPhrases(false);
    }
  }, [
    getEffectiveApiKey,
    setError,
    t,
    setShowSettings,
    stickerSetMode,
    gridCols,
    gridRows,
    buildFullContext,
    selectedTheme,
    selectedLanguage,
    setSinglePhrasesList,
    setSetPhrasesList,
    setActionDescsList,
  ]);

  return {
    isGeneratingPhrases,
    handleGeneratePhrases,
  };
}
