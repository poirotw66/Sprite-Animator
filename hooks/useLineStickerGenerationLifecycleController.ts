import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BgRemovalMethod, ChromaKeyColorType } from '../types';
import type { SliceSettings } from '../utils/imageUtils';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';
import { useLineStickerSheetGeneration } from './useLineStickerSheetGeneration';
import type {
  LineStickerGenerationTexts,
  LineStickerGenerationSetters,
} from './lineStickerSheetGenerationTypes';
import type { LineStickerRunController } from './useLineStickerRunState';

interface LifecycleState extends Pick<
  LineStickerRunController,
  'cancelRun' | 'resetRun' | 'setStage' | 'sheetStatuses' | 'updateSheetStatus'
> {
  setIsGenerating: (value: boolean) => void;
  setStatusText: (value: string) => void;
  setError: (value: string | null) => void;
}

interface LifecycleOutputs {
  setSheetImages: Dispatch<SetStateAction<(string | null)[]>>;
  setProcessedSheetImages: Dispatch<SetStateAction<(string | null)[]>>;
  setSheetFrames: Dispatch<SetStateAction<string[][]>>;
  setSelectedFramesBySheet: Dispatch<SetStateAction<boolean[][]>>;
  setSpriteSheetImage: Dispatch<SetStateAction<string | null>>;
  setProcessedSpriteSheet: Dispatch<SetStateAction<string | null>>;
  setIsProcessingChromaKey: Dispatch<SetStateAction<boolean>>;
  setChromaKeyProgress: Dispatch<SetStateAction<number>>;
  resetSetOutputState: () => void;
  optimizeSheetSlice: (image: string, sheetIndex: LineStickerSheetIndex) => Promise<SliceSettings | undefined>;
}

interface SingleSheetOutputs {
  setImage: Dispatch<SetStateAction<string | null>>;
  setProcessedImage: Dispatch<SetStateAction<string | null>>;
  setIsProcessingChromaKey: Dispatch<SetStateAction<boolean>>;
  setChromaKeyProgress: Dispatch<SetStateAction<number>>;
  resetGeneratedOutputs: () => void;
}

/**
 * Coordinates requests that produce artifacts: one-sheet generation, parallel
 * set generation, cancellation, and the reset required before mode/reference
 * changes. Design state and result presentation remain outside this controller.
 */
export function useLineStickerGenerationLifecycleController({
  getEffectiveApiKey,
  sourceImage,
  stickerSetMode,
  setPhrasesList,
  actionDescsList,
  currentSheetIndex,
  generateSingleSheet,
  texts,
  chromaKeyColor,
  bgRemovalMethod,
  sliceProcessedSheetToFrames,
  output,
  singleSheet,
  state,
  setShowSettings,
  setSourceImage,
  setStylePreviewImage,
  setStickerSetMode,
  resetOverlayState,
}: {
  getEffectiveApiKey: () => string;
  sourceImage: string | null;
  stickerSetMode: boolean;
  setPhrasesList: string[];
  actionDescsList: string[];
  currentSheetIndex: LineStickerSheetIndex;
  generateSingleSheet: (
    phrases?: string[],
    actionDescs?: string[],
    options?: { suppressUiState?: boolean; throwOnError?: boolean; onStatusChange?: (status: string) => void; signal?: AbortSignal },
  ) => Promise<string | null>;
  texts: LineStickerGenerationTexts;
  chromaKeyColor: ChromaKeyColorType;
  bgRemovalMethod: BgRemovalMethod;
  sliceProcessedSheetToFrames: (image: string, options?: { sheetIndex?: LineStickerSheetIndex; sliceSettingsOverride?: SliceSettings }) => Promise<string[]>;
  output: LifecycleOutputs;
  singleSheet: SingleSheetOutputs;
  state: LifecycleState;
  setShowSettings: (value: boolean) => void;
  setSourceImage: Dispatch<SetStateAction<string | null>>;
  setStylePreviewImage: Dispatch<SetStateAction<string | null>>;
  setStickerSetMode: Dispatch<SetStateAction<boolean>>;
  resetOverlayState: () => void;
}) {
  const {
    setSheetImages,
    setProcessedSheetImages,
    setSheetFrames,
    setSelectedFramesBySheet,
    setSpriteSheetImage,
    setProcessedSpriteSheet,
    setIsProcessingChromaKey: setSetIsProcessingChromaKey,
    setChromaKeyProgress: setSetChromaKeyProgress,
    resetSetOutputState,
    optimizeSheetSlice,
  } = output;
  const {
    setImage,
    setProcessedImage,
    setIsProcessingChromaKey: setSingleIsProcessingChromaKey,
    setChromaKeyProgress: setSingleChromaKeyProgress,
    resetGeneratedOutputs: resetSingleGeneratedOutputs,
  } = singleSheet;
  const {
    setStatusText,
    setError,
    setIsGenerating,
    cancelRun,
    resetRun,
    setStage,
    sheetStatuses,
    updateSheetStatus,
  } = state;
  const setters: LineStickerGenerationSetters = {
    setStatusText,
    setError,
    setShowSettings,
    setIsGenerating,
    cancelRun,
    resetRun,
    setRunStage: setStage,
    sheetStatuses,
    updateSheetStatus,
    setSheetImages,
    setProcessedSheetImages,
    setSheetFrames,
    setSelectedFramesBySheet,
    setSpriteSheetImage: stickerSetMode ? setSpriteSheetImage : setImage,
    setProcessedSpriteSheet: stickerSetMode ? setProcessedSpriteSheet : setProcessedImage,
    setIsProcessingChromaKey: stickerSetMode ? setSetIsProcessingChromaKey : setSingleIsProcessingChromaKey,
    setChromaKeyProgress: stickerSetMode ? setSetChromaKeyProgress : setSingleChromaKeyProgress,
  };

  const sheetGeneration = useLineStickerSheetGeneration({
    api: { getEffectiveApiKey },
    sourceImage,
    stickerSetMode,
    setPhrasesList,
    actionDescsList,
    currentSheetIndex,
    generateSingleSheet,
    texts,
    chroma: { chromaKeyColor, bgRemovalMethod },
    setters,
    sliceProcessedSheetToFrames,
    optimizeSheetSlice,
  });
  const { cancelActiveGeneration, resetSheetStatuses } = sheetGeneration;

  const resetGeneratedOutputs = useCallback(() => {
    cancelActiveGeneration();
    resetSingleGeneratedOutputs();
    resetSetOutputState();
    resetSheetStatuses();
    resetOverlayState();
    setStylePreviewImage(null);
    setStatusText('');
    setError(null);
    setIsGenerating(false);
  }, [
    cancelActiveGeneration,
    resetOverlayState,
    resetSetOutputState,
    resetSheetStatuses,
    resetSingleGeneratedOutputs,
    setError,
    setIsGenerating,
    setStatusText,
    setStylePreviewImage,
  ]);

  const handleUseStylePreview = useCallback((previewImage: string) => {
    resetGeneratedOutputs();
    setSourceImage(previewImage);
  }, [resetGeneratedOutputs, setSourceImage]);

  const handleStickerSetModeChange = useCallback((nextMode: boolean) => {
    if (nextMode === stickerSetMode) return;
    resetGeneratedOutputs();
    setStickerSetMode(nextMode);
  }, [resetGeneratedOutputs, setStickerSetMode, stickerSetMode]);

  return {
    ...sheetGeneration,
    resetGeneratedOutputs,
    handleStickerSetModeChange,
    handleUseStylePreview,
  };
}
