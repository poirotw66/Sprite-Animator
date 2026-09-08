import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { generateSpriteSheet } from '../services/geminiService';
import type { ChromaKeyColorType } from '../types';
import type { ImageResolution } from '../utils/constants';
import {
  buildLineStickerStylePreviewPrompt,
  DEFAULT_CHARACTER_SLOT,
  STYLE_PRESETS,
  type LineStickerStyleOption,
} from '../utils/lineStickerPrompt';

interface UseLineStickerStylePreviewParams {
  sourceImage: string | null;
  stylePreviewImage: string | null;
  setStylePreviewImage: Dispatch<SetStateAction<string | null>>;
  selectedStyle: LineStickerStyleOption;
  customStyleText: string;
  chromaKeyColor: ChromaKeyColorType;
  selectedModel: string;
  stylePreviewResolution: ImageResolution;
  getEffectiveApiKey: () => string;
  setError: (value: string | null) => void;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  errorApiKey: string;
  errorNoImage: string;
  errorGeneration: string;
  onUseStylePreview: (previewImage: string) => void;
}

/**
 * Generates and manages the one-cell style preview used by the LINE sticker flow.
 * Keeping this lifecycle together prevents the page controller from owning UI-only
 * preview state and its associated API error handling.
 */
export function useLineStickerStylePreview({
  sourceImage,
  stylePreviewImage,
  setStylePreviewImage,
  selectedStyle,
  customStyleText,
  chromaKeyColor,
  selectedModel,
  stylePreviewResolution,
  getEffectiveApiKey,
  setError,
  setShowSettings,
  errorApiKey,
  errorNoImage,
  errorGeneration,
  onUseStylePreview,
}: UseLineStickerStylePreviewParams) {
  const [isGeneratingStylePreview, setIsGeneratingStylePreview] = useState(false);

  useEffect(() => {
    setStylePreviewImage(null);
  }, [customStyleText, selectedStyle, setStylePreviewImage, sourceImage]);

  const handleGenerateStylePreview = useCallback(async () => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
      setError(errorApiKey);
      setShowSettings(true);
      return;
    }
    if (!sourceImage) {
      setError(errorNoImage);
      return;
    }

    const style = selectedStyle === 'custom'
      ? {
          styleType: customStyleText.trim() || 'Custom style from user input.',
          drawingMethod: customStyleText.trim()
            ? `Apply this style consistently: ${customStyleText.trim()}`
            : 'Follow the user-provided style description.',
        }
      : STYLE_PRESETS[selectedStyle];
    const prompt = buildLineStickerStylePreviewPrompt({
      style,
      character: DEFAULT_CHARACTER_SLOT,
    });

    setError(null);
    setIsGeneratingStylePreview(true);
    try {
      const preview = await generateSpriteSheet(
        sourceImage,
        prompt,
        1,
        1,
        apiKey,
        selectedModel,
        undefined,
        chromaKeyColor,
        stylePreviewResolution,
        false
      );
      setStylePreviewImage(preview);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : errorGeneration);
    } finally {
      setIsGeneratingStylePreview(false);
    }
  }, [
    chromaKeyColor,
    customStyleText,
    errorApiKey,
    errorGeneration,
    errorNoImage,
    getEffectiveApiKey,
    selectedModel,
    selectedStyle,
    setError,
    setShowSettings,
    setStylePreviewImage,
    sourceImage,
    stylePreviewResolution,
  ]);

  const handleDownloadStylePreview = useCallback(() => {
    if (!stylePreviewImage) return;
    const link = document.createElement('a');
    link.href = stylePreviewImage;
    link.download = 'line-sticker-style-preview.png';
    link.click();
  }, [stylePreviewImage]);

  const handleUseStylePreviewAsReference = useCallback(() => {
    if (stylePreviewImage) {
      onUseStylePreview(stylePreviewImage);
    }
  }, [onUseStylePreview, stylePreviewImage]);

  return {
    stylePreviewImage,
    isGeneratingStylePreview,
    handleGenerateStylePreview,
    handleDownloadStylePreview,
    handleUseStylePreviewAsReference,
  };
}
