import { useCallback, useState } from 'react';
import { generateActionDescriptions, generateStickerPhrases } from '../services/geminiService';
import {
  CHARACTER_PRESETS,
  getActionHint,
  TEXT_PRESETS,
  THEME_PRESETS,
  type ThemeOption,
} from '../utils/lineStickerPrompt';
import type { StickerPhraseMode } from '../utils/constants';
import { logger } from '../utils/logger';

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
  characterPreset: keyof typeof CHARACTER_PRESETS | 'custom';
  characterAppearance: string;
  characterPersonality: string;
  selectedLanguage: keyof typeof TEXT_PRESETS;
  selectedPhraseMode: StickerPhraseMode;
  setCustomPhrases: (value: string) => void;
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
  characterPreset,
  characterAppearance,
  characterPersonality,
  selectedLanguage,
  selectedPhraseMode,
  setCustomPhrases,
  setSetPhrasesList,
  setActionDescsList,
  t,
}: UseLineStickerPhraseGenerationParams) {
  const [isGeneratingPhrases, setIsGeneratingPhrases] = useState(false);

  const buildFullContext = useCallback((): string => {
    const themeInfo =
      selectedTheme === 'custom'
        ? customThemeContext || '自訂主題'
        : `${THEME_PRESETS[selectedTheme].label} (${THEME_PRESETS[selectedTheme].chatContext})`;

    const characterValue =
      characterPreset !== 'custom'
        ? CHARACTER_PRESETS[characterPreset].label
        : `${characterAppearance} (${characterPersonality})`;

    return `角色：${characterValue}\n主題：${themeInfo}`;
  }, [
    selectedTheme,
    customThemeContext,
    characterPreset,
    characterAppearance,
    characterPersonality,
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
      const count = stickerSetMode ? 48 : gridCols * gridRows;
      const fullContext = buildFullContext();
      const langLabel = TEXT_PRESETS[selectedLanguage]?.label || selectedLanguage;

      const phrases = await generateStickerPhrases(
        key,
        fullContext,
        langLabel,
        count,
        selectedPhraseMode
      );
      setCustomPhrases(phrases.join('\n'));
      setSetPhrasesList(phrases);

      try {
        const actionDescs = await generateActionDescriptions(key, phrases);
        setActionDescsList(actionDescs);
      } catch (actionErr: unknown) {
        logger.warn(
          'Action descriptions fallback to getActionHint:',
          actionErr instanceof Error ? actionErr.message : actionErr
        );
        setActionDescsList(phrases.map((phrase) => getActionHint(phrase)));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
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
    selectedLanguage,
    selectedPhraseMode,
    setCustomPhrases,
    setSetPhrasesList,
    setActionDescsList,
  ]);

  return {
    isGeneratingPhrases,
    handleGeneratePhrases,
  };
}
