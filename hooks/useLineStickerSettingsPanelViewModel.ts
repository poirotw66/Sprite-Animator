import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { Translations } from '../i18n/types';
import type { SliceSettings } from '../utils/imageUtils';
import type { ChromaKeyColorType, BgRemovalMethod } from '../types';
import type {
  ThemeOption,
  LineStickerStyleOption,
  LineStickerPromptVersion,
  LineStickerTextRendering,
  TEXT_PRESETS,
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
} from '../utils/lineStickerPrompt';
import type { ProgrammaticTextOverlayTuning } from '../utils/lineStickerTextOverlay';
import type { LineStickerSettingsPanelViewModel } from '../components/LineSticker/LineStickerSettingsPanel';
import type { LineStickerSheetStatus } from './useLineStickerSheetGeneration';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';
import type { LineStickerSetOverviewItem } from '../components/LineSticker/LineStickerSetOverviewPanel';
import type { ActionDedupeStrength } from '../services/gemini/actionDescriptions';

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
  stylePreviewImage: string | null;
  isGeneratingStylePreview: boolean;
  onGenerateStylePreview: () => void;
  onDownloadStylePreview: () => void;
  onUseStylePreviewAsReference: () => void;
  customStyleText: string;
  setCustomStyleText: React.Dispatch<React.SetStateAction<string>>;
  selectedTheme: ThemeOption;
  setSelectedTheme: React.Dispatch<React.SetStateAction<ThemeOption>>;
  customThemeContext: string;
  setCustomThemeContext: React.Dispatch<React.SetStateAction<string>>;
  bgRemovalMethod: BgRemovalMethod;
  setBgRemovalMethod: React.Dispatch<React.SetStateAction<BgRemovalMethod>>;
  chromaKeyColor: ChromaKeyColorType;
  setChromaKeyColor: React.Dispatch<React.SetStateAction<ChromaKeyColorType>>;
  includeText: boolean;
  setIncludeText: React.Dispatch<React.SetStateAction<boolean>>;
  textRendering: LineStickerTextRendering;
  setTextRendering: React.Dispatch<React.SetStateAction<LineStickerTextRendering>>;
  selectedLanguage: keyof typeof TEXT_PRESETS;
  setSelectedLanguage: React.Dispatch<React.SetStateAction<keyof typeof TEXT_PRESETS>>;
  selectedPromptVersion: LineStickerPromptVersion;
  setSelectedPromptVersion: React.Dispatch<React.SetStateAction<LineStickerPromptVersion>>;
  actionDedupeStrength: ActionDedupeStrength;
  setActionDedupeStrength: React.Dispatch<React.SetStateAction<ActionDedupeStrength>>;
  selectedFont: keyof typeof FONT_PRESETS;
  setSelectedFont: React.Dispatch<React.SetStateAction<keyof typeof FONT_PRESETS>>;
  selectedTextColor: keyof typeof TEXT_COLOR_PRESETS;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<keyof typeof TEXT_COLOR_PRESETS>>;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
  setProgrammaticTextTuning: React.Dispatch<React.SetStateAction<ProgrammaticTextOverlayTuning>>;
  onResetProgrammaticTextTuning: () => void;
  currentSheetIndex: LineStickerSheetIndex;
  phraseGridList: string[];
  actionDescGridList: string[];
  phraseGridCols: number;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
  isGeneratingPhrases: boolean;
  isBackfillingActionDescs: boolean;
  handleGeneratePhrases: () => void;
  phraseSetFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadPhraseSet: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadPhraseSet: () => void;
  setCurrentSheetIndex: (index: LineStickerSheetIndex) => void;
  onSelectOverviewSheet: (index: LineStickerSheetIndex) => void;
  previewPrompt: string | null;
  promptCopied: boolean;
  handleGeneratePromptPreview: () => void;
  handleCopyPrompt: () => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onGenerateAllSheets: () => void;
  onCancelGeneration: () => void;
  sheetStatuses: LineStickerSheetStatus[];
  sheetOverviewItems: LineStickerSetOverviewItem[];
  hasFailedSheets: boolean;
  onRetryFailedSheets: () => void;
  onRetrySheet: (sheetIndex: LineStickerSheetIndex) => void;
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
  stylePreviewImage,
  isGeneratingStylePreview,
  onGenerateStylePreview,
  onDownloadStylePreview,
  onUseStylePreviewAsReference,
  customStyleText,
  setCustomStyleText,
  selectedTheme,
  setSelectedTheme,
  customThemeContext,
  setCustomThemeContext,
  bgRemovalMethod,
  setBgRemovalMethod,
  chromaKeyColor,
  setChromaKeyColor,
  includeText,
  setIncludeText,
  textRendering,
  setTextRendering,
  selectedLanguage,
  setSelectedLanguage,
  selectedPromptVersion,
  setSelectedPromptVersion,
  actionDedupeStrength,
  setActionDedupeStrength,
  selectedFont,
  setSelectedFont,
  selectedTextColor,
  setSelectedTextColor,
  programmaticTextTuning,
  setProgrammaticTextTuning,
  onResetProgrammaticTextTuning,
  currentSheetIndex,
  phraseGridList,
  actionDescGridList,
  phraseGridCols,
  updatePhraseAt,
  updateActionDescAt,
  isGeneratingPhrases,
  isBackfillingActionDescs,
  handleGeneratePhrases,
  phraseSetFileInputRef,
  handleUploadPhraseSet,
  handleDownloadPhraseSet,
  setCurrentSheetIndex,
  onSelectOverviewSheet,
  previewPrompt,
  promptCopied,
  handleGeneratePromptPreview,
  handleCopyPrompt,
  isGenerating,
  onGenerate,
  onGenerateAllSheets,
  onCancelGeneration,
  sheetStatuses,
  sheetOverviewItems,
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
    stylePreviewImage,
    isGeneratingStylePreview,
    onGenerateStylePreview,
    onDownloadStylePreview,
    onUseStylePreviewAsReference,
    customStyleText,
    setCustomStyleText,
    selectedTheme,
    setSelectedTheme,
    customThemeContext,
    setCustomThemeContext,
    bgRemovalMethod,
    setBgRemovalMethod,
    chromaKeyColor,
    setChromaKeyColor,
    includeText,
    setIncludeText,
    textRendering,
    setTextRendering,
    selectedLanguage,
    setSelectedLanguage,
    selectedPromptVersion,
    setSelectedPromptVersion,
    actionDedupeStrength,
    setActionDedupeStrength,
    selectedFont,
    setSelectedFont,
    selectedTextColor,
    setSelectedTextColor,
    programmaticTextTuning,
    setProgrammaticTextTuning,
    onResetProgrammaticTextTuning,
  }), [
    stickerSetMode,
    onStickerSetModeChange,
    gridCols,
    gridRows,
    handleGridColsChange,
    handleGridRowsChange,
    selectedStyle,
    setSelectedStyle,
    stylePreviewImage,
    isGeneratingStylePreview,
    onGenerateStylePreview,
    onDownloadStylePreview,
    onUseStylePreviewAsReference,
    customStyleText,
    setCustomStyleText,
    selectedTheme,
    setSelectedTheme,
    customThemeContext,
    setCustomThemeContext,
    bgRemovalMethod,
    setBgRemovalMethod,
    chromaKeyColor,
    setChromaKeyColor,
    includeText,
    setIncludeText,
    textRendering,
    setTextRendering,
    selectedLanguage,
    setSelectedLanguage,
    selectedPromptVersion,
    setSelectedPromptVersion,
    actionDedupeStrength,
    setActionDedupeStrength,
    selectedFont,
    setSelectedFont,
    selectedTextColor,
    setSelectedTextColor,
    programmaticTextTuning,
    setProgrammaticTextTuning,
    onResetProgrammaticTextTuning,
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
    isBackfillingActionDescs,
    handleGeneratePhrases,
    phraseSetFileInputRef,
    handleUploadPhraseSet,
    handleDownloadPhraseSet,
    setCurrentSheetIndex,
    onSelectOverviewSheet,
    previewPrompt,
    selectedPromptVersion,
    promptCopied,
    handleGeneratePromptPreview,
    handleCopyPrompt,
    isGenerating,
    sourceImage,
    onGenerate,
    onGenerateAllSheets,
    onCancelGeneration,
    sheetStatuses,
    sheetOverviewItems,
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
    isBackfillingActionDescs,
    handleGeneratePhrases,
    phraseSetFileInputRef,
    handleUploadPhraseSet,
    handleDownloadPhraseSet,
    setCurrentSheetIndex,
    onSelectOverviewSheet,
    previewPrompt,
    selectedPromptVersion,
    promptCopied,
    handleGeneratePromptPreview,
    handleCopyPrompt,
    isGenerating,
    sourceImage,
    onGenerate,
    onGenerateAllSheets,
    onCancelGeneration,
    sheetStatuses,
    sheetOverviewItems,
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