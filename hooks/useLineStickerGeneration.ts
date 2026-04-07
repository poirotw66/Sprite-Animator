import { useState, useCallback } from 'react';
import {
    STYLE_PRESETS,
    TEXT_PRESETS,
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    THEME_PRESETS,
    DEFAULT_CHARACTER_SLOT,
    buildLineStickerPrompt,
    type ThemeOption,
    type LineStickerStyleOption,
} from '../utils/lineStickerPrompt';
import { getErrorMessage } from '../types/errors';
import { generateSpriteSheet } from '../services/geminiService';
import { logger } from '../utils/logger';
import { useLanguage } from './useLanguage';
import type { ImageResolution } from '../utils/constants';

interface UseLineStickerGenerationProps {
    apiKey: string | null;
    selectedModel: string;
    selectedStyle: LineStickerStyleOption;
    /** Used when selectedStyle === 'custom'. */
    customStyleText?: string;
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
    /** Output resolution (1K / 2K / 4K). Gemini 2.5 Flash supports 1K only. */
    selectedResolution?: ImageResolution;
}

interface GenerateSingleSheetOptions {
    suppressUiState?: boolean;
    throwOnError?: boolean;
    onStatusChange?: (status: string) => void;
}

export const useLineStickerGeneration = ({
    apiKey,
    selectedModel,
    selectedStyle,
    customStyleText = '',
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
    selectedResolution,
}: UseLineStickerGenerationProps) => {
    const { t } = useLanguage();
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const totalFrames = gridCols * gridRows;

    const buildPrompt = useCallback((phraseListOverride?: string[], actionDescsOverride?: string[]) => {
        const characterSlot = { ...DEFAULT_CHARACTER_SLOT };

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

        const styleSlot =
            selectedStyle === 'custom'
                ? {
                    styleType: customStyleText.trim() || 'Custom style (user did not specify).',
                    drawingMethod: customStyleText.trim()
                        ? `Apply this style consistently: ${customStyleText.trim()}`
                        : 'Follow the style description above.',
                }
                : STYLE_PRESETS[selectedStyle];

        const slots = {
            style: styleSlot,
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
        selectedStyle,
        customStyleText,
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

    const generateSingleSheet = useCallback(async (
        phraseListOverride?: string[],
        actionDescsOverride?: string[],
        options: GenerateSingleSheetOptions = {}
    ) => {
        const { suppressUiState = false, throwOnError = false, onStatusChange } = options;

        if (!apiKey) {
            if (!suppressUiState) {
                setError(t.errorApiKey);
            }
            if (throwOnError) {
                throw new Error(t.errorApiKey);
            }
            return null;
        }

        if (!suppressUiState) {
            setIsGenerating(true);
            setError(null);
            setStatusText(t.lineStickerGenerating);
        }
        onStatusChange?.(t.lineStickerGenerating);

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
                (status) => {
                    if (!suppressUiState) {
                        setStatusText(status);
                    }
                    onStatusChange?.(status);
                },
                chromaKeyColor,
                selectedResolution,
                includeText
            );
            return result;
        } catch (err: unknown) {
            logger.error('Generation failed:', err);
            const errorMessage = getErrorMessage(err) || t.errorGeneration;
            if (!suppressUiState) {
                setError(errorMessage);
            }
            if (throwOnError) {
                throw err;
            }
            return null;
        } finally {
            if (!suppressUiState) {
                setIsGenerating(false);
                setStatusText('');
            }
            onStatusChange?.('');
        }
    }, [apiKey, selectedModel, sourceImage, buildPrompt, selectedResolution, t]);

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
