import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getErrorMessage } from '../types/errors';
import { removeBackgroundAI } from '../utils/aiBackgroundRemoval';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import { CHROMA_KEY_COLORS, CHROMA_KEY_FUZZ } from '../utils/constants';
import type { BgRemovalMethod, ChromaKeyColorType } from '../types';

const SET_PHRASES_COUNT = 48;
const FRAMES_PER_SHEET = 16;

export interface LineStickerGenerationTexts {
  errorApiKey: string;
  errorNoImage: string;
  lineStickerErrorNeedPhrases: string;
  lineStickerParallelGenerating: string;
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
    actionDescsOverride?: string[]
  ) => Promise<string | null>;
  texts: LineStickerGenerationTexts;
  chroma: { chromaKeyColor: ChromaKeyColorType; bgRemovalMethod: BgRemovalMethod };
  setters: LineStickerGenerationSetters;
  sliceProcessedSheetToFrames: (processedImage: string) => Promise<string[]>;
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
    async (image: string, withProgress: boolean): Promise<string> => {
      if (bgRemovalMethod === 'ai') {
        return removeBackgroundAI(image, chromaKeyColor);
      }
      return removeChromaKeyWithWorker(
        image,
        CHROMA_KEY_COLORS[chromaKeyColor],
        CHROMA_KEY_FUZZ,
        withProgress ? (progress) => setChromaKeyProgress(progress) : undefined
      );
    },
    [bgRemovalMethod, chromaKeyColor, setChromaKeyProgress]
  );

  const reRunChromaKey = useCallback(
    async (image: string): Promise<string> => {
      setIsProcessingChromaKey(true);
      setChromaKeyProgress(0);
      try {
        const result = await removeBackground(image, true);
        setChromaKeyProgress(100);
        return result;
      } finally {
        setIsProcessingChromaKey(false);
      }
    },
    [removeBackground, setIsProcessingChromaKey, setChromaKeyProgress]
  );

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

    setIsGenerating(true);
    setError(null);
    try {
      if (stickerSetMode) {
        if (setPhrasesList.length < FRAMES_PER_SHEET) {
          setError(
            t.lineStickerErrorNeedPhrases.replace('{n}', String(setPhrasesList.length))
          );
          setIsGenerating(false);
          return;
        }

        const phraseSlice = setPhrasesList.slice(
          currentSheetIndex * FRAMES_PER_SHEET,
          (currentSheetIndex + 1) * FRAMES_PER_SHEET
        );
        const actionSlice = actionDescsList.slice(
          currentSheetIndex * FRAMES_PER_SHEET,
          (currentSheetIndex + 1) * FRAMES_PER_SHEET
        );
        const generated = await generateSingleSheet(phraseSlice, actionSlice);
        if (!generated) {
          setIsGenerating(false);
          return;
        }

        setSheetImages((prev) => {
          const next = [...prev];
          next[currentSheetIndex] = generated;
          return next;
        });

        setStatusText(t.statusProcessing);
        setIsProcessingChromaKey(true);
        const processed = await removeBackground(generated, true);
        setIsProcessingChromaKey(false);

        setProcessedSheetImages((prev) => {
          const next = [...prev];
          next[currentSheetIndex] = processed;
          return next;
        });

        const frames = await sliceProcessedSheetToFrames(processed);
        setSheetFrames((prev) => {
          const next = [...prev];
          next[currentSheetIndex] = frames;
          return next;
        });
        setSelectedFramesBySheet((prev) => {
          const next = prev.map((entry) => [...entry]);
          next[currentSheetIndex] = new Array(frames.length).fill(false);
          return next;
        });
        setStatusText('');
      } else {
        const generated = await generateSingleSheet();
        if (!generated) {
          setIsGenerating(false);
          return;
        }

        setSpriteSheetImage(generated);
        setStatusText(t.statusProcessing);
        setIsProcessingChromaKey(true);
        const processed = await removeBackground(generated, true);
        setIsProcessingChromaKey(false);
        setProcessedSpriteSheet(processed);
        setStatusText('');
      }
    } catch (err: unknown) {
      toUserError(err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    getEffectiveApiKey,
    setError,
    t,
    setShowSettings,
    sourceImage,
    setIsGenerating,
    stickerSetMode,
    setPhrasesList,
    currentSheetIndex,
    actionDescsList,
    generateSingleSheet,
    setSheetImages,
    setStatusText,
    setIsProcessingChromaKey,
    removeBackground,
    setProcessedSheetImages,
    sliceProcessedSheetToFrames,
    setSheetFrames,
    setSelectedFramesBySheet,
    setSpriteSheetImage,
    setProcessedSpriteSheet,
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

    setStatusText(t.lineStickerParallelGenerating);
    setIsGenerating(true);
    setError(null);
    try {
      const results = await Promise.all(
        [0, 1, 2].map((i) => {
          const phraseSlice = setPhrasesList.slice(
            i * FRAMES_PER_SHEET,
            (i + 1) * FRAMES_PER_SHEET
          );
          const actionSlice = actionDescsList.slice(
            i * FRAMES_PER_SHEET,
            (i + 1) * FRAMES_PER_SHEET
          );
          return generateSingleSheet(phraseSlice, actionSlice);
        })
      );

      setIsGenerating(true);
      const validResults = results.filter((value): value is string => value !== null);
      if (validResults.length < 3) {
        setError(t.errorGeneration);
        setIsGenerating(false);
        return;
      }

      setSheetImages(validResults);
      setStatusText(t.statusProcessing);

      const processed = await Promise.all(
        validResults.map((image) => removeBackground(image, false))
      );
      setProcessedSheetImages(processed);

      const allFrames = await Promise.all(
        processed.map((image) => sliceProcessedSheetToFrames(image))
      );
      setSheetFrames(allFrames);
      setSelectedFramesBySheet(
        allFrames.map((frames) => new Array(frames.length).fill(false))
      );
      setStatusText('');
    } catch (err: unknown) {
      toUserError(err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    getEffectiveApiKey,
    setError,
    t,
    setShowSettings,
    sourceImage,
    setPhrasesList,
    setStatusText,
    setIsGenerating,
    actionDescsList,
    generateSingleSheet,
    setSheetImages,
    removeBackground,
    setProcessedSheetImages,
    sliceProcessedSheetToFrames,
    setSheetFrames,
    setSelectedFramesBySheet,
    toUserError,
  ]);

  return {
    handleGenerate,
    handleGenerateAllSheets,
    reRunChromaKey,
  };
}
