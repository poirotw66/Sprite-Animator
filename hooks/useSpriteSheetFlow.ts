/**
 * Shared flow: upload → slice settings → remove background (chroma) → frame list.
 * Used by PartingPage and LineStickerPage (single-sheet mode) to avoid duplicate logic.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import {
  sliceSpriteSheet,
  sliceSpriteSheetByCellRects,
  getEffectivePadding,
  type AutoSliceFallbackHint,
  type SliceSettings,
  type FrameOverride,
} from '../utils/imageUtils';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import {
  DEFAULT_SLICE_SETTINGS,
  BACKGROUND_REMOVAL_THRESHOLD,
  DEBOUNCE_DELAY,
  CHROMA_KEY_COLORS,
  CHROMA_KEY_FUZZ,
} from '../utils/constants';
import { optimizeSliceSettings } from '../utils/optimizeSliceSettings';
import { logger } from '../utils/logger';
import type { ChromaKeyColorType } from '../types';
import {
  applyAutoSliceCandidateToSettings,
  applyAutoSliceHintToSettings,
  buildAutoSliceAttemptKey,
  didAutoSliceSettingsChange,
  resolveAutoSlicePipelineForSettings,
  shouldShowAutoSliceHint,
} from './autoSliceIntegration';

export interface UseSpriteSheetFlowOptions {
  /** When true (default), run chroma key on image change. When false, processedImage is only set via setProcessedImage (e.g. AI removal). */
  runChromaAutomatically?: boolean;
  initialSliceSettings?: SliceSettings;
}

export interface UseSpriteSheetFlowResult {
  // Source image (uploaded or set by page)
  image: string | null;
  setImage: Dispatch<SetStateAction<string | null>>;

  // After chroma key (or external set via setProcessedImage)
  processedImage: string | null;
  setProcessedImage: Dispatch<SetStateAction<string | null>>;

  // Slice config
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;

  // Remove background toggle + chroma color
  removeBackground: boolean;
  setRemoveBackground: (value: boolean) => void;
  chromaKeyColor: ChromaKeyColorType;
  setChromaKeyColor: (value: ChromaKeyColorType) => void;

  // Output frames
  frames: string[];
  setFrames: React.Dispatch<React.SetStateAction<string[]>>;
  frameOverrides: FrameOverride[];
  setFrameOverrides: React.Dispatch<React.SetStateAction<FrameOverride[]>>;
  frameIncluded: boolean[];
  setFrameIncluded: React.Dispatch<React.SetStateAction<boolean[]>>;

  // Dimensions (from image load)
  sheetDimensions: { width: number; height: number };
  handleImageLoad: (e: SyntheticEvent<HTMLImageElement>) => void;

  // Chroma key progress (setters for external callers e.g. generation hook)
  chromaKeyProgress: number;
  isProcessingChromaKey: boolean;
  setChromaKeyProgress: Dispatch<SetStateAction<number>>;
  setIsProcessingChromaKey: Dispatch<SetStateAction<boolean>>;

  // Actions
  reRunChromaKey: (image: string) => Promise<string>;
  sliceProcessedSheetToFrames: (processedImage: string) => Promise<string[]>;
  optimizeSlice: () => Promise<void>;
  autoSliceHint: AutoSliceFallbackHint | null;
  applyAutoSliceHint: () => void;
}

export function useSpriteSheetFlow(
  options: UseSpriteSheetFlowOptions = {}
): UseSpriteSheetFlowResult {
  const {
    runChromaAutomatically = true,
    initialSliceSettings = DEFAULT_SLICE_SETTINGS as SliceSettings,
  } = options;

  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImageState] = useState<string | null>(null);
  const [sliceSettings, setSliceSettings] = useState<SliceSettings>(initialSliceSettings);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('green');
  const [frames, setFrames] = useState<string[]>([]);
  const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);
  const [frameIncluded, setFrameIncluded] = useState<boolean[]>([]);
  const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
  const [chromaKeyProgress, setChromaKeyProgress] = useState(0);
  const [isProcessingChromaKey, setIsProcessingChromaKey] = useState(false);
  const [autoSliceHint, setAutoSliceHint] = useState<AutoSliceFallbackHint | null>(null);
  const autoSliceAttemptKeyRef = useRef<string | null>(null);
  const autoSliceHintShownKeyRef = useRef<string | null>(null);

  const activeChromaKeyColor = CHROMA_KEY_COLORS[chromaKeyColor];

  // Chroma key: when image changes and runChromaAutomatically && removeBackground
  useEffect(() => {
    if (!image) {
      setProcessedImageState(null);
      setChromaKeyProgress(0);
      setIsProcessingChromaKey(false);
      return;
    }
    if (!removeBackground) {
      setProcessedImageState(image);
      return;
    }
    if (!runChromaAutomatically) {
      return;
    }
    setProcessedImageState(null);
    setChromaKeyProgress(0);
    setIsProcessingChromaKey(true);
    const processImage = async () => {
      try {
        const result = await removeChromaKeyWithWorker(
          image,
          activeChromaKeyColor,
          CHROMA_KEY_FUZZ,
          (p) => setChromaKeyProgress(p)
        );
        setProcessedImageState(result);
        setChromaKeyProgress(100);
      } catch (e) {
        logger.error('Chroma key removal failed', e);
        setProcessedImageState(image);
      } finally {
        setIsProcessingChromaKey(false);
      }
    };
    processImage();
  }, [image, removeBackground, runChromaAutomatically, activeChromaKeyColor]);

  // When removeBackground is turned off, processed = image
  useEffect(() => {
    if (image && !removeBackground) {
      setProcessedImageState(image);
    }
  }, [image, removeBackground]);

  useEffect(() => {
    if (!processedImage) {
      autoSliceAttemptKeyRef.current = null;
      autoSliceHintShownKeyRef.current = null;
      setAutoSliceHint(null);
    }
  }, [processedImage]);

  // Re-slice when processedImage or sliceSettings or frameOverrides change
  useEffect(() => {
    const source = processedImage;
    if (!source) {
      setFrames([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        if (
          sliceSettings.sliceMode === 'inferred' &&
          sliceSettings.inferredCellRects?.length
        ) {
          const result = await sliceSpriteSheetByCellRects(
            source,
            sliceSettings.inferredCellRects
          );
          if (!cancelled) {
            setFrames(result);
            setFrameIncluded(new Array(result.length).fill(true));
          }
        } else {
          let effectiveSliceSettings = sliceSettings;
          const autoSliceKey = buildAutoSliceAttemptKey(source, sliceSettings);

          if (autoSliceAttemptKeyRef.current !== autoSliceKey) {
            autoSliceAttemptKeyRef.current = autoSliceKey;
            const pipelineResult = await resolveAutoSlicePipelineForSettings(source, sliceSettings);

            if (cancelled) {
              return;
            }

            if (pipelineResult?.status === 'accepted') {
              const nextSliceSettings = applyAutoSliceCandidateToSettings(
                sliceSettings,
                pipelineResult.selected.candidate
              );
              setAutoSliceHint(null);
              effectiveSliceSettings = nextSliceSettings;

              if (didAutoSliceSettingsChange(sliceSettings, nextSliceSettings)) {
                setSliceSettings((prev) =>
                  applyAutoSliceCandidateToSettings(prev, pipelineResult.selected.candidate)
                );
                return;
              }
            } else if (shouldShowAutoSliceHint(pipelineResult)) {
              if (autoSliceHintShownKeyRef.current !== autoSliceKey) {
                autoSliceHintShownKeyRef.current = autoSliceKey;
                setAutoSliceHint(pipelineResult.hint);
              }
            } else {
              setAutoSliceHint(null);
            }
          }

          const padding = getEffectivePadding(effectiveSliceSettings);
          const result = await sliceSpriteSheet(
            source,
            effectiveSliceSettings.cols,
            effectiveSliceSettings.rows,
            effectiveSliceSettings.paddingX,
            effectiveSliceSettings.paddingY,
            effectiveSliceSettings.shiftX,
            effectiveSliceSettings.shiftY,
            false,
            BACKGROUND_REMOVAL_THRESHOLD,
            frameOverrides,
            chromaKeyColor,
            padding
          );
          if (!cancelled) {
            setFrames(result);
            setFrameIncluded(new Array(result.length).fill(true));
          }
        }
      } catch (e) {
        if (!cancelled) logger.error('Re-slice failed', e);
      }
    };
    const timer = setTimeout(run, DEBOUNCE_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    processedImage,
    sliceSettings.sliceMode,
    sliceSettings.inferredCellRects,
    sliceSettings.cols,
    sliceSettings.rows,
    sliceSettings.paddingX,
    sliceSettings.paddingY,
    sliceSettings.paddingLeft,
    sliceSettings.paddingRight,
    sliceSettings.paddingTop,
    sliceSettings.paddingBottom,
    sliceSettings.shiftX,
    sliceSettings.shiftY,
    frameOverrides,
    chromaKeyColor,
  ]);

  // Sync frameIncluded length when frames change (keep selection where possible)
  useEffect(() => {
    if (frames.length === 0) {
      setFrameIncluded([]);
      return;
    }
    setFrameIncluded((prev) => {
      if (prev.length === frames.length) return prev;
      const next = new Array(frames.length).fill(true);
      for (let i = 0; i < Math.min(prev.length, frames.length); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [frames.length]);

  // Reset frame overrides when grid/source changes
  useEffect(() => {
    setFrameOverrides([]);
  }, [processedImage, sliceSettings.cols, sliceSettings.rows]);

  // Sheet dimensions from processed image
  useEffect(() => {
    if (processedImage) {
      const img = new Image();
      img.onload = () => {
        setSheetDimensions({ width: img.width, height: img.height });
      };
      img.onerror = () => logger.error('Failed to load processed sprite sheet');
      img.src = processedImage;
    }
  }, [processedImage]);

  const handleImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      if (!processedImage) {
        setSheetDimensions({
          width: e.currentTarget.naturalWidth,
          height: e.currentTarget.naturalHeight,
        });
      }
    },
    [processedImage]
  );

  const applyAutoSliceHint = useCallback(() => {
    setAutoSliceHint((currentHint) => {
      if (!currentHint) {
        return currentHint;
      }
      setSliceSettings((prev) => applyAutoSliceHintToSettings(prev, currentHint));
      return null;
    });
  }, []);

  const reRunChromaKey = useCallback(
    async (img: string): Promise<string> => {
      setIsProcessingChromaKey(true);
      setChromaKeyProgress(0);
      try {
        const result = await removeChromaKeyWithWorker(
          img,
          activeChromaKeyColor,
          CHROMA_KEY_FUZZ,
          (p) => setChromaKeyProgress(p)
        );
        setChromaKeyProgress(100);
        return result;
      } finally {
        setIsProcessingChromaKey(false);
      }
    },
    [activeChromaKeyColor]
  );

  const sliceProcessedSheetToFrames = useCallback(
    async (processedImg: string): Promise<string[]> => {
      if (
        sliceSettings.sliceMode === 'inferred' &&
        sliceSettings.inferredCellRects?.length
      ) {
        return sliceSpriteSheetByCellRects(
          processedImg,
          sliceSettings.inferredCellRects
        );
      }
      const padding = getEffectivePadding(sliceSettings);
      return sliceSpriteSheet(
        processedImg,
        sliceSettings.cols,
        sliceSettings.rows,
        sliceSettings.paddingX,
        sliceSettings.paddingY,
        sliceSettings.shiftX,
        sliceSettings.shiftY,
        false,
        BACKGROUND_REMOVAL_THRESHOLD,
        frameOverrides,
        chromaKeyColor,
        padding
      );
    },
    [sliceSettings, frameOverrides, chromaKeyColor]
  );

  const optimizeSlice = useCallback(async () => {
    const source = processedImage ?? image;
    if (!source) return;
    const optimized = await optimizeSliceSettings(
      source,
      sliceSettings.cols,
      sliceSettings.rows
    );
    setSliceSettings((prev) => ({
      ...prev,
      paddingLeft: optimized.paddingLeft,
      paddingRight: optimized.paddingRight,
      paddingTop: optimized.paddingTop,
      paddingBottom: optimized.paddingBottom,
      paddingX: Math.round((optimized.paddingLeft + optimized.paddingRight) / 2),
      paddingY: Math.round((optimized.paddingTop + optimized.paddingBottom) / 2),
      shiftX: optimized.shiftX,
      shiftY: optimized.shiftY,
      autoOptimized: {
        paddingX: true,
        paddingY: true,
        shiftX: true,
        shiftY: true,
      },
    }));
  }, [processedImage, image, sliceSettings.cols, sliceSettings.rows]);

  return {
    image,
    setImage,
    processedImage,
    setProcessedImage: setProcessedImageState,
    sliceSettings,
    setSliceSettings,
    removeBackground,
    setRemoveBackground,
    chromaKeyColor,
    setChromaKeyColor,
    frames,
    setFrames,
    frameOverrides,
    setFrameOverrides,
    frameIncluded,
    setFrameIncluded,
    sheetDimensions,
    handleImageLoad,
    chromaKeyProgress,
    isProcessingChromaKey,
    setChromaKeyProgress,
    setIsProcessingChromaKey,
    reRunChromaKey,
    sliceProcessedSheetToFrames,
    optimizeSlice,
    autoSliceHint,
    applyAutoSliceHint,
  };
}
