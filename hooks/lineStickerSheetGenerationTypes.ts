/**
 * Types and small pure helpers for useLineStickerSheetGeneration. Extracted so
 * the hook file holds the request lifecycle and generation logic, not the large
 * option/status type surface.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { BgRemovalMethod, ChromaKeyColorType } from '../types';
import type { SliceSettings } from '../utils/imageUtils';
import {
  createLineStickerSheetArray,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';

export type LineStickerSheetStage =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'processing'
  | 'slicing'
  | 'completed'
  | 'failed';

export interface LineStickerSheetStatus {
  sheetIndex: LineStickerSheetIndex;
  stage: LineStickerSheetStage;
  progress: number;
  message: string;
  error: string | null;
  attempts: number;
}

export function isActiveSheetStage(stage: LineStickerSheetStage): boolean {
  return (
    stage === 'queued' ||
    stage === 'generating' ||
    stage === 'processing' ||
    stage === 'slicing'
  );
}

export function createInitialSheetStatuses(): LineStickerSheetStatus[] {
  return createLineStickerSheetArray((sheetIndex) => ({
    sheetIndex,
    stage: 'idle',
    progress: 0,
    message: '',
    error: null,
    attempts: 0,
  }));
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
  setStatusText: (value: string) => void;
  setError: (value: string | null) => void;
  setShowSettings: (value: boolean) => void;
  setIsGenerating: (value: boolean) => void;
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
