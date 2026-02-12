import { useState, useCallback } from 'react';
import {
    STYLE_PRESETS,
    TEXT_PRESETS,
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    THEME_PRESETS,
    DEFAULT_CHARACTER_SLOT,
    CHARACTER_PRESETS,
    buildLineStickerPrompt,
    type ThemeOption,
} from '../utils/lineStickerPrompt';
import { generateSpriteSheet } from '../services/geminiService';
import { logger } from '../utils/logger';
import { useLanguage } from './useLanguage';

interface UseLineStickerGenerationProps {
    apiKey: string | null;
    selectedModel: string;
    characterPreset: keyof typeof CHARACTER_PRESETS | 'custom';
    characterAppearance: string;
    characterPersonality: string;
    selectedStyle: keyof typeof STYLE_PRESETS;
    selectedTheme: ThemeOption;
    customThemeContext: string;
    customPhrasesList: string[];
    /** Optional per-cell action descriptions (same length as customPhrasesList); used in [5. Grid Content]. */
    customActionDescsList?: string[];
    selectedLanguage: keyof typeof TEXT_PRESETS;
    selectedTextColor: keyof typeof TEXT_COLOR_PRESETS;
    selectedFont: keyof typeof FONT_PRESETS;
    gridCols: number;
    gridRows: number;
    chromaKeyColor: 'magenta' | 'green';
    sourceImage: string | null;
    includeText: boolean;
}

export const useLineStickerGeneration = ({
    apiKey,
    selectedModel,
    characterPreset,
    characterAppearance,
    characterPersonality,
    selectedStyle,
    selectedTheme,
    customThemeContext,
    customPhrasesList,
    customActionDescsList,
    selectedLanguage,
    selectedTextColor,
    selectedFont,
    gridCols,
    gridRows,
    chromaKeyColor,
    sourceImage,
    includeText,
}: UseLineStickerGenerationProps) => {
    const { t } = useLanguage();
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const totalFrames = gridCols * gridRows;

    const buildPrompt = useCallback((phraseListOverride?: string[], actionDescsOverride?: string[]) => {
        let characterSlot = { ...DEFAULT_CHARACTER_SLOT };

        if (characterPreset !== 'custom') {
            const preset = CHARACTER_PRESETS[characterPreset];
            characterSlot.appearance = preset.appearance;
            characterSlot.personality = preset.personality;
        } else {
            if (characterAppearance.trim()) characterSlot.appearance = characterAppearance.trim();
            if (characterPersonality.trim()) characterSlot.personality = characterPersonality.trim();
        }

        const examplePhrases =
            phraseListOverride ??
            (customPhrasesList.length > 0 ? customPhrasesList : (selectedTheme === 'custom' ? [] : THEME_PRESETS[selectedTheme].examplePhrases));

        const themeSlot = selectedTheme === 'custom'
            ? {
                chatContext: customThemeContext.trim() || 'Custom chat theme',
                examplePhrases,
            }
            : {
                ...THEME_PRESETS[selectedTheme],
                examplePhrases,
            };

        const slots = {
            style: STYLE_PRESETS[selectedStyle],
            character: characterSlot,
            theme: themeSlot,
            text: {
                ...TEXT_PRESETS[selectedLanguage],
                textColor: TEXT_COLOR_PRESETS[selectedTextColor].promptDesc,
                textStyle: FONT_PRESETS[selectedFont].promptDesc,
            },
        };

        const actionDescs = actionDescsOverride ?? (customActionDescsList && customActionDescsList.length >= totalFrames
            ? customActionDescsList.slice(0, totalFrames)
            : customActionDescsList && customActionDescsList.length > 0
                ? [...customActionDescsList, ...Array(totalFrames - customActionDescsList.length).fill('')].slice(0, totalFrames)
                : undefined);

        return buildLineStickerPrompt(slots, gridCols, gridRows, chromaKeyColor, includeText, actionDescs);
    }, [
        characterPreset,
        characterAppearance,
        characterPersonality,
        selectedTheme,
        customThemeContext,
        customPhrasesList,
        customActionDescsList,
        totalFrames,
        selectedStyle,
        selectedLanguage,
        selectedTextColor,
        selectedFont,
        gridCols,
        gridRows,
        chromaKeyColor,
        includeText,
    ]);

    const generateSingleSheet = useCallback(async (phraseListOverride?: string[], actionDescsOverride?: string[]) => {
        if (!apiKey) {
            setError(t.errorApiKey);
            return null;
        }

        setIsGenerating(true);
        setError(null);
        setStatusText(t.lineStickerGenerating);

        try {
            const prompt = buildPrompt(phraseListOverride, actionDescsOverride);
            // generateSpriteSheet(imageBase64, prompt, cols, rows, apiKey, model, onProgress, chromaKeyColor, outputResolution)
            const result = await generateSpriteSheet(
                sourceImage || '',
                prompt,
                gridCols,
                gridRows,
                apiKey,
                selectedModel,
                (status) => setStatusText(status),
                chromaKeyColor
            );
            return result;
        } catch (err: any) {
            logger.error('Generation failed:', err);
            setError(err.message || t.errorGeneration);
            return null;
        } finally {
            setIsGenerating(false);
            setStatusText('');
        }
    }, [apiKey, selectedModel, sourceImage, buildPrompt, t]);

    return {
        isGenerating,
        setIsGenerating,
        statusText,
        setStatusText,
        error,
        setError,
        generateSingleSheet,
        buildPrompt,
    };
};
