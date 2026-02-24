import { useCallback, useState } from 'react';
import { generateActionDescriptions, generateStickerPhrases } from '../services/geminiService';
import {
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
  customThemeScenario?: string;
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
  customThemeScenario,
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
        ? customThemeContext?.trim() || 'Custom theme'
        : `${THEME_PRESETS[selectedTheme].label} (${THEME_PRESETS[selectedTheme].chatContext})`;

    const scenarioLine =
      selectedTheme === 'custom'
        ? (customThemeScenario?.trim() && `Scenario/audience: ${customThemeScenario.trim()}`) || ''
        : `Scenario/audience: ${THEME_PRESETS[selectedTheme].chatContext}`;

    const blocks = ['Character/style: From uploaded reference image only (no preset).', `Theme: ${themeInfo}`];
    if (scenarioLine) blocks.push(scenarioLine);
    return blocks.join('\n');
  }, [
    selectedTheme,
    customThemeContext,
    customThemeScenario,
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
      const examplePhrases =
        selectedTheme === 'custom' ? [] : THEME_PRESETS[selectedTheme].examplePhrases;

      const phrases = await generateStickerPhrases(
        key,
        fullContext,
        langLabel,
        count,
        selectedPhraseMode,
        undefined,
        examplePhrases
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
    selectedTheme,
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
