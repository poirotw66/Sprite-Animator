/**
 * Types and small pure helpers for useLineStickerSheetGeneration. Extracted so
 * the hook file holds the request lifecycle and generation logic, not the large
 * option/status type surface.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { BgRemovalMethod, ChromaKeyColorType } from '../types';
import type { SliceSettings } from '../utils/imageUtils';
import type { PipelineStage } from '../features/line-sticker/domain';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';

export type LineStickerSheetStage =
  | Extract<PipelineStage, 'idle' | 'queued' | 'generating' | 'processing' | 'slicing' | 'failed' | 'cancelled'>
  | 'completed';

export interface LineStickerSheetStatus {
  sheetIndex: LineStickerSheetIndex;
  stage: LineStickerSheetStage;
  progress: number;
  message: string;
  error: string | null;
  attempts: number;
}

export interface LineStickerGenerationTexts {
  errorApiKey: string;
  errorNoImage: string;
  lineStickerErrorNeedPhrases: string;
  lineStickerParallelGenerating: string;
  lineStickerGeneratingSheetN: string;
  lineStickerProcessingSheetN: string;
  lineStickerQueuedSheetN: string;
  lineStickerSlicingSheetN: string;
  lineStickerSheetReadyN: string;
  lineStickerSheetFailedN: string;
  lineStickerRetryFailed: string;
  lineStickerErrorSomeSheetsFailed: string;
  statusProcessing: string;
  errorGeneration: string;
}

/** Grouped setters to keep hook options readable and testable. */
export interface LineStickerGenerationSetters {
  setError: (value: string | null) => void;
  setShowSettings: (value: boolean) => void;
  startRun: () => number;
  finishRun: (runId: number) => void;
  setRunMessage: (runId: number, value: string) => void;
  setRunError: (runId: number, value: string) => void;
  setRunStage: (runId: number, stage: PipelineStage, message?: string | null) => void;
  cancelRun: (runId: number) => void;
  resetRun: () => void;
  sheetStatuses: LineStickerSheetStatus[];
  updateSheetStatus: (
    runId: number,
    sheetIndex: LineStickerSheetIndex,
    patch: Partial<LineStickerSheetStatus>
  ) => void;
  setSheetImages: Dispatch<SetStateAction<(string | null)[]>>;
  setProcessedSheetImages: Dispatch<SetStateAction<(string | null)[]>>;
  setSheetFrames: Dispatch<SetStateAction<string[][]>>;
  setSelectedFramesBySheet: Dispatch<SetStateAction<boolean[][]>>;
  setSpriteSheetImage: Dispatch<SetStateAction<string | null>>;
  setProcessedSpriteSheet: Dispatch<SetStateAction<string | null>>;
  setIsProcessingChromaKey: Dispatch<SetStateAction<boolean>>;
  setChromaKeyProgress: Dispatch<SetStateAction<number>>;
}

/** Single options object for LINE sticker sheet generation (replaces 20+ flat params). */
export interface UseLineStickerSheetGenerationOptions {
  api: { getEffectiveApiKey: () => string };
  sourceImage: string | null;
  stickerSetMode: boolean;
  setPhrasesList: string[];
  actionDescsList: string[];
  currentSheetIndex: LineStickerSheetIndex;
  generateSingleSheet: (
    phraseListOverride?: string[],
    actionDescsOverride?: string[],
    options?: {
      suppressUiState?: boolean;
      throwOnError?: boolean;
      onStatusChange?: (status: string) => void;
      signal?: AbortSignal;
    }
  ) => Promise<string | null>;
  texts: LineStickerGenerationTexts;
  chroma: { chromaKeyColor: ChromaKeyColorType; bgRemovalMethod: BgRemovalMethod };
  setters: LineStickerGenerationSetters;
  sliceProcessedSheetToFrames: (
    processedImage: string,
    options?: { sheetIndex?: LineStickerSheetIndex; sliceSettingsOverride?: SliceSettings }
  ) => Promise<string[]>;
  /** Set mode: optimize padding/shift on processed sheet before slicing. */
  optimizeSheetSlice?: (
    processedImage: string,
    sheetIndex: LineStickerSheetIndex
  ) => Promise<SliceSettings | undefined>;
}
