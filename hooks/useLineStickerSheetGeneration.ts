import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getErrorMessage } from '../types/errors';
import { removeBackgroundAI } from '../utils/aiBackgroundRemoval';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import { CHROMA_KEY_COLORS, CHROMA_KEY_FUZZ } from '../utils/constants';
import type { BgRemovalMethod, ChromaKeyColorType } from '../types';
import { createAbortError, isAbortError } from '../utils/abort';

const SET_PHRASES_COUNT = 48;
const FRAMES_PER_SHEET = 16;
const BULK_CONCURRENCY = 2;
const SHEET_INDICES = [0, 1, 2] as const;
const CANCELLED_REQUEST_MESSAGE = '__line_sticker_generation_cancelled__';

type SheetIndex = (typeof SHEET_INDICES)[number];

export type LineStickerSheetStage =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'processing'
  | 'slicing'
  | 'completed'
  | 'failed';

export interface LineStickerSheetStatus {
  sheetIndex: SheetIndex;
  stage: LineStickerSheetStage;
  progress: number;
  message: string;
  error: string | null;
  attempts: number;
}

function isActiveSheetStage(stage: LineStickerSheetStage): boolean {
  return (
    stage === 'queued' ||
    stage === 'generating' ||
    stage === 'processing' ||
    stage === 'slicing'
  );
}

function createInitialSheetStatuses(): LineStickerSheetStatus[] {
  return SHEET_INDICES.map((sheetIndex) => ({
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
  currentSheetIndex: 0 | 1 | 2;
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
    options?: { sheetIndex?: 0 | 1 | 2 }
  ) => Promise<string[]>;
}

export function useLineStickerSheetGeneration(options: UseLineStickerSheetGenerationOptions) {
  const {
    api: { getEffectiveApiKey },
    sourceImage,
    stickerSetMode,
    setPhrasesList,
    actionDescsList,
    currentSheetIndex,
    generateSingleSheet,
    texts: t,
    chroma: { chromaKeyColor, bgRemovalMethod },
    setters: {
      setStatusText,
      setError,
      setShowSettings,
      setIsGenerating,
      setSheetImages,
      setProcessedSheetImages,
      setSheetFrames,
      setSelectedFramesBySheet,
      setSpriteSheetImage,
      setProcessedSpriteSheet,
      setIsProcessingChromaKey,
      setChromaKeyProgress,
    },
    sliceProcessedSheetToFrames,
  } = options;

  const [sheetStatuses, setSheetStatuses] = useState<LineStickerSheetStatus[]>(() =>
    createInitialSheetStatuses()
  );
  const requestCounterRef = useRef(0);
  const activeRequestIdRef = useRef<number | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const failedSheetIndices = useMemo(
    () =>
      sheetStatuses
        .filter((status) => status.stage === 'failed')
        .map((status) => status.sheetIndex),
    [sheetStatuses]
  );

  const updateSheetStatus = useCallback(
    (
      sheetIndex: SheetIndex,
      updater:
        | Partial<LineStickerSheetStatus>
        | ((current: LineStickerSheetStatus) => Partial<LineStickerSheetStatus>)
    ) => {
      setSheetStatuses((prev) =>
        prev.map((entry) => {
          if (entry.sheetIndex !== sheetIndex) {
            return entry;
          }
          const patch = typeof updater === 'function' ? updater(entry) : updater;
          return { ...entry, ...patch };
        })
      );
    },
    []
  );

  const isRequestActive = useCallback((requestId: number) => {
    return activeRequestIdRef.current === requestId;
  }, []);

  const isCancelledRequestError = useCallback((err: unknown) => {
    return (err instanceof Error && err.message === CANCELLED_REQUEST_MESSAGE) || isAbortError(err);
  }, []);

  const throwIfRequestInactive = useCallback(
    (requestId: number) => {
      if (!isRequestActive(requestId)) {
        throw new Error(CANCELLED_REQUEST_MESSAGE);
      }
    },
    [isRequestActive]
  );

  const resetInFlightSheetStatuses = useCallback(() => {
    setSheetStatuses((prev) =>
      prev.map((status) =>
        isActiveSheetStage(status.stage)
          ? {
              ...status,
              stage: 'idle',
              progress: 0,
              message: '',
              error: null,
            }
          : status
      )
    );
  }, []);

  const resetSheetStatuses = useCallback(() => {
    setSheetStatuses(createInitialSheetStatuses());
  }, []);

  const startRequest = useCallback(() => {
    activeAbortControllerRef.current?.abort(createAbortError('Superseded by a newer request'));
    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;
    activeRequestIdRef.current = requestId;
    activeAbortControllerRef.current = new AbortController();
    resetInFlightSheetStatuses();
    setChromaKeyProgress(0);
    setIsProcessingChromaKey(false);
    return requestId;
  }, [resetInFlightSheetStatuses, setChromaKeyProgress, setIsProcessingChromaKey]);

  const finishRequest = useCallback(
    (requestId: number, clearStatusText: boolean = true) => {
      if (!isRequestActive(requestId)) {
        return;
      }
      activeRequestIdRef.current = null;
      activeAbortControllerRef.current = null;
      setIsGenerating(false);
      setIsProcessingChromaKey(false);
      setChromaKeyProgress(0);
      if (clearStatusText) {
        setStatusText('');
      }
    },
    [
      isRequestActive,
      setChromaKeyProgress,
      setIsGenerating,
      setIsProcessingChromaKey,
      setStatusText,
    ]
  );

  const cancelActiveGeneration = useCallback(() => {
    activeAbortControllerRef.current?.abort(createAbortError('User cancelled generation'));
    activeAbortControllerRef.current = null;
    activeRequestIdRef.current = null;
    resetInFlightSheetStatuses();
    setIsGenerating(false);
    setIsProcessingChromaKey(false);
    setChromaKeyProgress(0);
    setStatusText('');
  }, [
    resetInFlightSheetStatuses,
    setChromaKeyProgress,
    setIsGenerating,
    setIsProcessingChromaKey,
    setStatusText,
  ]);

  const getSheetLabel = useCallback(
    (sheetIndex: SheetIndex) => String(sheetIndex + 1),
    []
  );

  const toUserError = useCallback(
    (err: unknown) => {
      const msg = getErrorMessage(err);
      if (msg.includes('API Key is missing')) {
        setError(t.errorApiKey);
        setShowSettings(true);
        return;
      }
      setError(`${t.errorGeneration}: ${msg}`);
    },
    [setError, setShowSettings, t]
  );

  const removeBackground = useCallback(
    async (
      image: string,
      signal?: AbortSignal,
      onProgress?: (progress: number) => void
    ): Promise<string> => {
      if (bgRemovalMethod === 'ai') {
        return removeBackgroundAI(image, chromaKeyColor, signal);
      }
      return removeChromaKeyWithWorker(
        image,
        CHROMA_KEY_COLORS[chromaKeyColor],
        CHROMA_KEY_FUZZ,
        onProgress,
        undefined,
        signal
      );
    },
    [bgRemovalMethod, chromaKeyColor]
  );

  const reRunChromaKey = useCallback(
    async (image: string): Promise<string> => {
      setIsProcessingChromaKey(true);
      setChromaKeyProgress(0);
      try {
        const result = await removeBackground(image, undefined, (progress) => setChromaKeyProgress(progress));
        setChromaKeyProgress(100);
        return result;
      } finally {
        setIsProcessingChromaKey(false);
      }
    },
    [removeBackground, setIsProcessingChromaKey, setChromaKeyProgress]
  );

  const runSetSheetPipeline = useCallback(
    async (
      sheetIndex: SheetIndex,
      options: {
        useGlobalProgress?: boolean;
        requestId: number;
      }
    ) => {
      const { useGlobalProgress = false, requestId } = options;
      const signal = activeAbortControllerRef.current?.signal;
      throwIfRequestInactive(requestId);

      const phraseSlice = setPhrasesList.slice(
        sheetIndex * FRAMES_PER_SHEET,
        (sheetIndex + 1) * FRAMES_PER_SHEET
      );
      const actionSlice = actionDescsList.slice(
        sheetIndex * FRAMES_PER_SHEET,
        (sheetIndex + 1) * FRAMES_PER_SHEET
      );

      if (phraseSlice.length < FRAMES_PER_SHEET) {
        throw new Error(
          t.lineStickerErrorNeedPhrases.replace('{n}', String(setPhrasesList.length))
        );
      }

      updateSheetStatus(sheetIndex, (current) => ({
        stage: 'generating',
        progress: 15,
        message: t.lineStickerGeneratingSheetN.replace('{n}', getSheetLabel(sheetIndex)),
        error: null,
        attempts: current.attempts + 1,
      }));

      const generated = await generateSingleSheet(phraseSlice, actionSlice, {
        suppressUiState: true,
        throwOnError: true,
        signal,
        onStatusChange: (status) => {
          if (!status || !isRequestActive(requestId)) {
            return;
          }
          updateSheetStatus(sheetIndex, {
            message: status,
          });
        },
      });
      throwIfRequestInactive(requestId);
      if (!generated) {
        throw new Error(t.errorGeneration);
      }

      setSheetImages((prev) => {
        const next = [...prev];
        next[sheetIndex] = generated;
        return next;
      });

      updateSheetStatus(sheetIndex, {
        stage: 'processing',
        progress: 40,
        message: t.lineStickerProcessingSheetN.replace('{n}', getSheetLabel(sheetIndex)),
        error: null,
      });

      if (useGlobalProgress) {
        throwIfRequestInactive(requestId);
        setIsProcessingChromaKey(true);
        setChromaKeyProgress(0);
      }

      const processed = await removeBackground(generated, signal, (progress) => {
        if (!isRequestActive(requestId)) {
          return;
        }
        const normalizedProgress = Math.min(85, 40 + Math.round(progress * 0.45));
        updateSheetStatus(sheetIndex, {
          stage: 'processing',
          progress: normalizedProgress,
          message: t.lineStickerProcessingSheetN.replace('{n}', getSheetLabel(sheetIndex)),
        });
        if (useGlobalProgress) {
          setChromaKeyProgress(progress);
        }
      });
      throwIfRequestInactive(requestId);

      setProcessedSheetImages((prev) => {
        const next = [...prev];
        next[sheetIndex] = processed;
        return next;
      });

      updateSheetStatus(sheetIndex, {
        stage: 'slicing',
        progress: 90,
        message: t.lineStickerSlicingSheetN.replace('{n}', getSheetLabel(sheetIndex)),
        error: null,
      });

      const frames = await sliceProcessedSheetToFrames(processed, { sheetIndex });
      throwIfRequestInactive(requestId);
      setSheetFrames((prev) => {
        const next = [...prev];
        next[sheetIndex] = frames;
        return next;
      });
      setSelectedFramesBySheet((prev) => {
        const next = prev.map((entry) => [...entry]);
        next[sheetIndex] = new Array(frames.length).fill(false);
        return next;
      });

      if (useGlobalProgress) {
        throwIfRequestInactive(requestId);
        setChromaKeyProgress(100);
        setIsProcessingChromaKey(false);
      }

      updateSheetStatus(sheetIndex, {
        stage: 'completed',
        progress: 100,
        message: t.lineStickerSheetReadyN.replace('{n}', getSheetLabel(sheetIndex)),
        error: null,
      });
    },
    [
      actionDescsList,
      generateSingleSheet,
      isRequestActive,
      getSheetLabel,
      removeBackground,
      setChromaKeyProgress,
      setIsProcessingChromaKey,
      setPhrasesList,
      setProcessedSheetImages,
      setSelectedFramesBySheet,
      setSheetFrames,
      setSheetImages,
      sliceProcessedSheetToFrames,
      t,
      throwIfRequestInactive,
      updateSheetStatus,
    ]
  );

  const markSheetFailed = useCallback(
    (requestId: number, sheetIndex: SheetIndex, err: unknown) => {
      if (!isRequestActive(requestId) || isCancelledRequestError(err)) {
        return;
      }
      const message = getErrorMessage(err);
      updateSheetStatus(sheetIndex, {
        stage: 'failed',
        message: t.lineStickerSheetFailedN.replace('{n}', getSheetLabel(sheetIndex)),
        error: message,
      });
    },
    [getSheetLabel, isCancelledRequestError, isRequestActive, t, updateSheetStatus]
  );

  const retrySheet = useCallback(
    async (sheetIndex: SheetIndex) => {
      if (!getEffectiveApiKey()) {
        setError(t.errorApiKey);
        setShowSettings(true);
        return;
      }
      if (!sourceImage) {
        setError(t.errorNoImage);
        return;
      }

      const requestId = startRequest();
      setIsGenerating(true);
      setError(null);
      setStatusText(t.lineStickerGeneratingSheetN.replace('{n}', getSheetLabel(sheetIndex)));
      try {
        await runSetSheetPipeline(sheetIndex, { useGlobalProgress: true, requestId });
        if (isRequestActive(requestId)) {
          setStatusText('');
        }
      } catch (err: unknown) {
        if (!isCancelledRequestError(err)) {
          markSheetFailed(requestId, sheetIndex, err);
          if (isRequestActive(requestId)) {
            toUserError(err);
          }
        }
      } finally {
        finishRequest(requestId);
      }
    },
    [
      finishRequest,
      getEffectiveApiKey,
      getSheetLabel,
      isCancelledRequestError,
      isRequestActive,
      markSheetFailed,
      runSetSheetPipeline,
      setError,
      setIsGenerating,
      setShowSettings,
      setStatusText,
      sourceImage,
      startRequest,
      t,
      toUserError,
    ]
  );

  const retryFailedSheets = useCallback(async () => {
    if (failedSheetIndices.length === 0) {
      return;
    }

    if (!getEffectiveApiKey()) {
      setError(t.errorApiKey);
      setShowSettings(true);
      return;
    }
    if (!sourceImage) {
      setError(t.errorNoImage);
      return;
    }

    const requestId = startRequest();
    setStatusText(t.lineStickerRetryFailed);
    setIsGenerating(true);
    setError(null);
    setIsProcessingChromaKey(bgRemovalMethod === 'chroma');
    try {
      const queue = [...failedSheetIndices];
      queue.forEach((sheetIndex) => {
        if (!isRequestActive(requestId)) {
          return;
        }
        updateSheetStatus(sheetIndex, {
          stage: 'queued',
          progress: 5,
          message: t.lineStickerQueuedSheetN.replace('{n}', getSheetLabel(sheetIndex)),
          error: null,
        });
      });

      const workers = Array.from(
        { length: Math.min(BULK_CONCURRENCY, queue.length) },
        async () => {
          while (queue.length > 0 && isRequestActive(requestId)) {
            const nextSheet = queue.shift();
            if (nextSheet == null) {
              return;
            }
            try {
              await runSetSheetPipeline(nextSheet, { requestId });
            } catch (err: unknown) {
              if (!isCancelledRequestError(err)) {
                markSheetFailed(requestId, nextSheet, err);
              }
            }
          }
        }
      );

      await Promise.all(workers);
    } finally {
      finishRequest(requestId);
    }
  }, [
    bgRemovalMethod,
    failedSheetIndices,
    finishRequest,
    getEffectiveApiKey,
    getSheetLabel,
    isCancelledRequestError,
    isRequestActive,
    markSheetFailed,
    runSetSheetPipeline,
    setError,
    setIsGenerating,
    setIsProcessingChromaKey,
    setShowSettings,
    setStatusText,
    sourceImage,
    startRequest,
    t,
    updateSheetStatus,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!getEffectiveApiKey()) {
      setError(t.errorApiKey);
      setShowSettings(true);
      return;
    }
    if (!sourceImage) {
      setError(t.errorNoImage);
      return;
    }

    const requestId = startRequest();
    setIsGenerating(true);
    setError(null);
    try {
      if (stickerSetMode) {
        if (setPhrasesList.length < FRAMES_PER_SHEET) {
          setError(
            t.lineStickerErrorNeedPhrases.replace('{n}', String(setPhrasesList.length))
          );
          finishRequest(requestId);
          return;
        }

        setStatusText(
          t.lineStickerGeneratingSheetN.replace('{n}', getSheetLabel(currentSheetIndex))
        );
        await runSetSheetPipeline(currentSheetIndex, {
          useGlobalProgress: true,
          requestId,
        });
        if (isRequestActive(requestId)) {
          setStatusText('');
        }
      } else {
        const generated = await generateSingleSheet(undefined, undefined, {
          suppressUiState: true,
          throwOnError: true,
          signal: activeAbortControllerRef.current?.signal,
          onStatusChange: (status) => {
            if (!status || !isRequestActive(requestId)) {
              return;
            }
            setStatusText(status);
          },
        });
        throwIfRequestInactive(requestId);
        if (!generated) {
          throw new Error(t.errorGeneration);
        }

        setSpriteSheetImage(generated);
        setStatusText(t.statusProcessing);
        setIsProcessingChromaKey(true);
        const processed = await removeBackground(generated, activeAbortControllerRef.current?.signal, (progress) => {
          if (!isRequestActive(requestId)) {
            return;
          }
          setChromaKeyProgress(progress);
        });
        throwIfRequestInactive(requestId);
        setIsProcessingChromaKey(false);
        setProcessedSpriteSheet(processed);
        setStatusText('');
      }
    } catch (err: unknown) {
      if (!isCancelledRequestError(err)) {
        if (stickerSetMode) {
          markSheetFailed(requestId, currentSheetIndex, err);
        }
        if (isRequestActive(requestId)) {
          toUserError(err);
        }
      }
    } finally {
      finishRequest(requestId);
    }
  }, [
    finishRequest,
    getEffectiveApiKey,
    setError,
    t,
    setShowSettings,
    sourceImage,
    setIsGenerating,
    stickerSetMode,
    currentSheetIndex,
    generateSingleSheet,
    getSheetLabel,
    isCancelledRequestError,
    isRequestActive,
    markSheetFailed,
    setStatusText,
    setIsProcessingChromaKey,
    removeBackground,
    runSetSheetPipeline,
    setSpriteSheetImage,
    setProcessedSpriteSheet,
    setChromaKeyProgress,
    startRequest,
    throwIfRequestInactive,
    toUserError,
  ]);

  const handleGenerateAllSheets = useCallback(async () => {
    if (!getEffectiveApiKey()) {
      setError(t.errorApiKey);
      setShowSettings(true);
      return;
    }
    if (!sourceImage) {
      setError(t.errorNoImage);
      return;
    }
    if (setPhrasesList.length < SET_PHRASES_COUNT) {
      setError(
        t.lineStickerErrorNeedPhrases.replace('{n}', String(setPhrasesList.length))
      );
      return;
    }

    const requestId = startRequest();
    setStatusText(t.lineStickerParallelGenerating);
    setIsGenerating(true);
    setIsProcessingChromaKey(bgRemovalMethod === 'chroma');
    setChromaKeyProgress(0);
    setError(null);
    try {
      SHEET_INDICES.forEach((sheetIndex) => {
        if (!isRequestActive(requestId)) {
          return;
        }
        updateSheetStatus(sheetIndex, {
          stage: 'queued',
          progress: 5,
          message: t.lineStickerQueuedSheetN.replace('{n}', getSheetLabel(sheetIndex)),
          error: null,
        });
      });

      const queue = [...SHEET_INDICES];
      const failedIndices: SheetIndex[] = [];
      const workers = Array.from(
        { length: Math.min(BULK_CONCURRENCY, queue.length) },
        async () => {
          while (queue.length > 0 && isRequestActive(requestId)) {
            const nextSheet = queue.shift();
            if (nextSheet == null) {
              return;
            }
            try {
              await runSetSheetPipeline(nextSheet, { requestId });
            } catch (err: unknown) {
              if (!isCancelledRequestError(err)) {
                failedIndices.push(nextSheet);
                markSheetFailed(requestId, nextSheet, err);
              }
            }
          }
        }
      );

      await Promise.all(workers);

      if (isRequestActive(requestId) && failedIndices.length > 0) {
        setError(t.lineStickerErrorSomeSheetsFailed);
      }
      if (isRequestActive(requestId)) {
        setStatusText('');
      }
    } catch (err: unknown) {
      if (!isCancelledRequestError(err) && isRequestActive(requestId)) {
        toUserError(err);
      }
    } finally {
      finishRequest(requestId);
    }
  }, [
    bgRemovalMethod,
    finishRequest,
    getEffectiveApiKey,
    setError,
    t,
    setShowSettings,
    sourceImage,
    setPhrasesList,
    setStatusText,
    setIsGenerating,
    setIsProcessingChromaKey,
    setChromaKeyProgress,
    getSheetLabel,
    isCancelledRequestError,
    isRequestActive,
    markSheetFailed,
    runSetSheetPipeline,
    startRequest,
    toUserError,
    updateSheetStatus,
  ]);

  return {
    handleGenerate,
    handleGenerateAllSheets,
    reRunChromaKey,
    sheetStatuses,
    resetSheetStatuses,
    retryFailedSheets,
    retrySheet,
    hasFailedSheets: failedSheetIndices.length > 0,
    cancelActiveGeneration,
  };
}
