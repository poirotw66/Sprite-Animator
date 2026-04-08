import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { Translations } from '../i18n/types';
import type { SliceSettings } from '../utils/imageUtils';
import type { ChromaKeyColorType, BgRemovalMethod } from '../types';
import type { StickerPhraseMode } from '../utils/constants';
import type {
  ThemeOption,
  LineStickerStyleOption,
  TEXT_PRESETS,
  FONT_PRESETS,
} from '../utils/lineStickerPrompt';
import type { LineStickerSettingsPanelViewModel } from '../components/LineSticker/LineStickerSettingsPanel';
import type { LineStickerSheetStatus } from './useLineStickerSheetGeneration';

interface UseLineStickerSettingsPanelViewModelParams {
  t: Translations;
  sourceImage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenFilePicker: () => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  stickerSetMode: boolean;
  onStickerSetModeChange: (value: boolean) => void;
  gridCols: number;
  gridRows: number;
  setGridCols: React.Dispatch<React.SetStateAction<number>>;
  setGridRows: React.Dispatch<React.SetStateAction<number>>;
  setSingleSheetSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  selectedStyle: LineStickerStyleOption;
  setSelectedStyle: React.Dispatch<React.SetStateAction<LineStickerStyleOption>>;
  customStyleText: string;
  setCustomStyleText: React.Dispatch<React.SetStateAction<string>>;
  selectedTheme: ThemeOption;
  setSelectedTheme: React.Dispatch<React.SetStateAction<ThemeOption>>;
  customThemeContext: string;
  setCustomThemeContext: React.Dispatch<React.SetStateAction<string>>;
  customThemeScenario: string;
  setCustomThemeScenario: React.Dispatch<React.SetStateAction<string>>;
  bgRemovalMethod: BgRemovalMethod;
  setBgRemovalMethod: React.Dispatch<React.SetStateAction<BgRemovalMethod>>;
  chromaKeyColor: ChromaKeyColorType;
  setChromaKeyColor: React.Dispatch<React.SetStateAction<ChromaKeyColorType>>;
  includeText: boolean;
  setIncludeText: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLanguage: keyof typeof TEXT_PRESETS;
  setSelectedLanguage: React.Dispatch<React.SetStateAction<keyof typeof TEXT_PRESETS>>;
  selectedFont: keyof typeof FONT_PRESETS;
  setSelectedFont: React.Dispatch<React.SetStateAction<keyof typeof FONT_PRESETS>>;
  selectedPhraseMode: StickerPhraseMode;
  setSelectedPhraseMode: React.Dispatch<React.SetStateAction<StickerPhraseMode>>;
  currentSheetIndex: 0 | 1 | 2;
  phraseGridList: string[];
  actionDescGridList: string[];
  phraseGridCols: number;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
  isGeneratingPhrases: boolean;
  handleGeneratePhrases: () => void;
  phraseSetFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadPhraseSet: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadPhraseSet: () => void;
  setCurrentSheetIndex: (index: 0 | 1 | 2) => void;
  previewPrompt: string | null;
  promptCopied: boolean;
  handleGeneratePromptPreview: () => void;
  handleCopyPrompt: () => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onGenerateAllSheets: () => void;
  onCancelGeneration: () => void;
  sheetStatuses: LineStickerSheetStatus[];
  hasFailedSheets: boolean;
  onRetryFailedSheets: () => void;
  onRetrySheet: (sheetIndex: 0 | 1 | 2) => void;
}

export const useLineStickerSettingsPanelViewModel = ({
  t,
  sourceImage,
  fileInputRef,
  onOpenFilePicker,
  onDrop,
  onDragOver,
  onImageUpload,
  stickerSetMode,
  onStickerSetModeChange,
  gridCols,
  gridRows,
  setGridCols,
  setGridRows,
  setSingleSheetSliceSettings,
  selectedStyle,
  setSelectedStyle,
  customStyleText,
  setCustomStyleText,
  selectedTheme,
  setSelectedTheme,
  customThemeContext,
  setCustomThemeContext,
  customThemeScenario,
  setCustomThemeScenario,
  bgRemovalMethod,
  setBgRemovalMethod,
  chromaKeyColor,
  setChromaKeyColor,
  includeText,
  setIncludeText,
  selectedLanguage,
  setSelectedLanguage,
  selectedFont,
  setSelectedFont,
  selectedPhraseMode,
  setSelectedPhraseMode,
  currentSheetIndex,
  phraseGridList,
  actionDescGridList,
  phraseGridCols,
  updatePhraseAt,
  updateActionDescAt,
  isGeneratingPhrases,
  handleGeneratePhrases,
  phraseSetFileInputRef,
  handleUploadPhraseSet,
  handleDownloadPhraseSet,
  setCurrentSheetIndex,
  previewPrompt,
  promptCopied,
  handleGeneratePromptPreview,
  handleCopyPrompt,
  isGenerating,
  onGenerate,
  onGenerateAllSheets,
  onCancelGeneration,
  sheetStatuses,
  hasFailedSheets,
  onRetryFailedSheets,
  onRetrySheet,
}: UseLineStickerSettingsPanelViewModelParams): LineStickerSettingsPanelViewModel => {
  const handleGridColsChange = useCallback((value: number) => {
    setGridCols(value);
    setSingleSheetSliceSettings((prev) => ({ ...prev, cols: value }));
  }, [setGridCols, setSingleSheetSliceSettings]);

  const handleGridRowsChange = useCallback((value: number) => {
    setGridRows(value);
    setSingleSheetSliceSettings((prev) => ({ ...prev, rows: value }));
  }, [setGridRows, setSingleSheetSliceSettings]);

  const uploadCard = useMemo(() => ({
    title: t.lineStickerUploadTitle,
    uploadHint: t.lineStickerUploadHint,
    sourceImage,
    fileInputRef,
    onOpenFilePicker,
    onDrop,
    onDragOver,
    onImageUpload,
  }), [t, sourceImage, fileInputRef, onOpenFilePicker, onDrop, onDragOver, onImageUpload]);

  const config = useMemo(() => ({
    stickerSetMode,
    onStickerSetModeChange,
    gridCols,
    gridRows,
    onGridColsChange: handleGridColsChange,
    onGridRowsChange: handleGridRowsChange,
    selectedStyle,
    setSelectedStyle,
    customStyleText,
    setCustomStyleText,
    selectedTheme,
    setSelectedTheme,
    customThemeContext,
    setCustomThemeContext,
    customThemeScenario,
    setCustomThemeScenario,
    bgRemovalMethod,
    setBgRemovalMethod,
    chromaKeyColor,
    setChromaKeyColor,
    includeText,
    setIncludeText,
    selectedLanguage,
    setSelectedLanguage,
    selectedFont,
    setSelectedFont,
    selectedPhraseMode,
    setSelectedPhraseMode,
  }), [
    stickerSetMode,
    onStickerSetModeChange,
    gridCols,
    gridRows,
    handleGridColsChange,
    handleGridRowsChange,
    selectedStyle,
    setSelectedStyle,
    customStyleText,
    setCustomStyleText,
    selectedTheme,
    setSelectedTheme,
    customThemeContext,
    setCustomThemeContext,
    customThemeScenario,
    setCustomThemeScenario,
    bgRemovalMethod,
    setBgRemovalMethod,
    chromaKeyColor,
    setChromaKeyColor,
    includeText,
    setIncludeText,
    selectedLanguage,
    setSelectedLanguage,
    selectedFont,
    setSelectedFont,
    selectedPhraseMode,
    setSelectedPhraseMode,
  ]);

  const phraseSection = useMemo(() => ({
    t,
    stickerSetMode,
    currentSheetIndex,
    phraseGridList,
    actionDescGridList,
    phraseGridCols,
    updatePhraseAt,
    updateActionDescAt,
    isGeneratingPhrases,
    handleGeneratePhrases,
    phraseSetFileInputRef,
    handleUploadPhraseSet,
    handleDownloadPhraseSet,
    setCurrentSheetIndex,
    previewPrompt,
    promptCopied,
    handleGeneratePromptPreview,
    handleCopyPrompt,
    isGenerating,
    sourceImage,
    onGenerate,
    onGenerateAllSheets,
    onCancelGeneration,
    sheetStatuses,
    hasFailedSheets,
    onRetryFailedSheets,
    onRetrySheet,
  }), [
    t,
    stickerSetMode,
    currentSheetIndex,
    phraseGridList,
    actionDescGridList,
    phraseGridCols,
    updatePhraseAt,
    updateActionDescAt,
    isGeneratingPhrases,
    handleGeneratePhrases,
    phraseSetFileInputRef,
    handleUploadPhraseSet,
    handleDownloadPhraseSet,
    setCurrentSheetIndex,
    previewPrompt,
    promptCopied,
    handleGeneratePromptPreview,
    handleCopyPrompt,
    isGenerating,
    sourceImage,
    onGenerate,
    onGenerateAllSheets,
    onCancelGeneration,
    sheetStatuses,
    hasFailedSheets,
    onRetryFailedSheets,
    onRetrySheet,
  ]);

  return useMemo(() => ({
    uploadCard,
    config,
    phraseSection,
  }), [uploadCard, config, phraseSection]);
};