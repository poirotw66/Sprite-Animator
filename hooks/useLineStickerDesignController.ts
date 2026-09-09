import { useEffect, useState } from 'react';
import type { ActionDedupeStrength } from '../services/gemini/actionDescriptions';
import type { BgRemovalMethod, ChromaKeyColorType } from '../types';
import {
  FONT_PRESETS,
  resolveFontKeyForStyle,
  TEXT_COLOR_PRESETS,
  TEXT_PRESETS,
  type LineStickerPromptVersion,
  type LineStickerStyleOption,
  type LineStickerTextRendering,
  type ThemeOption,
} from '../utils/lineStickerPrompt';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  type ProgrammaticTextOverlayTuning,
} from '../utils/lineStickerTextOverlay';
import { useLineStickerJobTextState } from './useLineStickerJobTextState';

/**
 * Owns the editable design brief. Generated images deliberately live in the
 * single-sheet and set-output controllers, so changing a design never makes
 * this hook responsible for artifact lifecycle.
 */
export function useLineStickerDesignController() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(4);
  const [selectedStyle, setSelectedStyle] = useState<LineStickerStyleOption>('matchUploaded');
  const [customStyleText, setCustomStyleText] = useState('');
  const [customFontText, setCustomFontText] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('custom');
  const [customThemeContext, setCustomThemeContext] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof TEXT_PRESETS>('zh-TW');
  const [selectedPromptVersion, setSelectedPromptVersion] = useState<LineStickerPromptVersion>('v3');
  const [actionDedupeStrength, setActionDedupeStrength] = useState<ActionDedupeStrength>('balanced');
  const [selectedTextColor, setSelectedTextColor] = useState<keyof typeof TEXT_COLOR_PRESETS>('black');
  const [selectedFont, setSelectedFont] = useState<keyof typeof FONT_PRESETS>(() =>
    resolveFontKeyForStyle('matchUploaded'),
  );
  const [singlePhrasesList, setSinglePhrasesList] = useState<string[]>([]);
  const [stickerSetMode, setStickerSetMode] = useState(false);
  const {
    jobTextState,
    setPhrasesList,
    setSetPhrasesList,
    actionDescsList,
    setActionDescsList,
    replaceFromJobSheets,
    resetJobText,
  } = useLineStickerJobTextState();
  const [stylePreviewImage, setStylePreviewImage] = useState<string | null>(null);
  const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('green');
  const [bgRemovalMethod, setBgRemovalMethod] = useState<BgRemovalMethod>('chroma');
  const [includeText, setIncludeText] = useState(true);
  const [textRendering, setTextRendering] = useState<LineStickerTextRendering>('model');
  const [programmaticTextTuning, setProgrammaticTextTuning] = useState<ProgrammaticTextOverlayTuning>(
    () => ({ ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING }),
  );

  useEffect(() => {
    setSelectedFont(resolveFontKeyForStyle(selectedStyle));
  }, [selectedStyle]);

  return {
    sourceImage,
    setSourceImage,
    gridCols,
    setGridCols,
    gridRows,
    setGridRows,
    selectedStyle,
    setSelectedStyle,
    customStyleText,
    setCustomStyleText,
    customFontText,
    setCustomFontText,
    selectedTheme,
    setSelectedTheme,
    customThemeContext,
    setCustomThemeContext,
    selectedLanguage,
    setSelectedLanguage,
    selectedPromptVersion,
    setSelectedPromptVersion,
    actionDedupeStrength,
    setActionDedupeStrength,
    selectedTextColor,
    setSelectedTextColor,
    selectedFont,
    setSelectedFont,
    singlePhrasesList,
    setSinglePhrasesList,
    stickerSetMode,
    setStickerSetMode,
    setPhrasesList,
    setSetPhrasesList,
    actionDescsList,
    setActionDescsList,
    jobTextState,
    replaceFromJobSheets,
    resetJobText,
    stylePreviewImage,
    setStylePreviewImage,
    chromaKeyColor,
    setChromaKeyColor,
    bgRemovalMethod,
    setBgRemovalMethod,
    includeText,
    setIncludeText,
    textRendering,
    setTextRendering,
    programmaticTextTuning,
    setProgrammaticTextTuning,
  };
}

export type LineStickerDesignController = ReturnType<typeof useLineStickerDesignController>;
