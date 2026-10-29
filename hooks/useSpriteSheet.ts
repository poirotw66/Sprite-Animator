import { useState, useLayoutEffect, useMemo, useRef } from 'react';
import { SliceSettings, FrameOverride, getEffectivePadding, getCellRectForFrame, smartAutoAlignFrames } from '../utils/imageUtils';
import { sliceSheetWithSettings } from '../utils/sliceSheetWithSettings';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import { BACKGROUND_REMOVAL_THRESHOLD, DEBOUNCE_DELAY, CHROMA_KEY_COLORS, CHROMA_KEY_FUZZ } from '../utils/constants';
import { logger } from '../utils/logger';
import type { ChromaKeyColorType } from '../types';
import { isAbortError } from '../utils/abort';

export interface UseSpriteSheetSlicePipelineOptions {
  mapFramesAfterSlice?: (frames: string[]) => Promise<string[]>;
  /** Bumps the slice effect when overlay inputs change without changing `mapFramesAfterSlice` identity. */
  slicePipelineRevision?: string | number;
}

export interface SpriteSheetRestoration {
  revision: number;
  frameOverrides: FrameOverride[];
}

/**
 * Custom hook for managing sprite sheet slicing and frame generation.
 * Automatically re-slices the sprite sheet when settings change.
 *
 * @param spriteSheetImage - Base64 encoded sprite sheet image
 * @param sliceSettings - Configuration for slicing (cols, rows, padding, shift)
 * @param removeBackground - Whether to remove white/light backgrounds
 * @param mode - Current generation mode ('frame' or 'sheet')
 * @param chromaKeyColor - Which chroma key color to use ('magenta' or 'green')
 * @param slicePipeline - Optional post-process after each slice (e.g. programmatic text on cells)
 * @returns Object containing generated frames, sheet dimensions, and image load handler
 * 
 * @example
 * ```typescript
 * const {
 *   generatedFrames,
 *   sheetDimensions,
 *   handleImageLoad
 * } = useSpriteSheet(
 *   spriteSheetImage,
 *   sliceSettings,
 *   removeBackground,
 *   config.mode,
 *   config.chromaKeyColor,
 *   { mapFramesAfterSlice, slicePipelineRevision }
 * );
 * ```
 */
export const useSpriteSheet = (
  spriteSheetImage: string | null,
  sliceSettings: SliceSettings,
  removeBackground: boolean,
  mode: 'frame' | 'sheet',
  chromaKeyColor: ChromaKeyColorType = 'green',
  slicePipeline?: UseSpriteSheetSlicePipelineOptions | null,
  restoration?: SpriteSheetRestoration | null,
) => {
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
  const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
  const [chromaKeyProgress, setChromaKeyProgress] = useState<number>(0);
  const [isProcessingChromaKey, setIsProcessingChromaKey] = useState<boolean>(false);
  const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);
  const [completedRestorationRevision, setCompletedRestorationRevision] = useState<number | null>(null);
  const lastAlignedSheetRef = useRef<string | null>(null);
  const appliedRestorationRef = useRef<{ revision: number; source: string | null; cols: number; rows: number } | null>(null);
  const sliceSettingsRef = useRef(sliceSettings);
  const restorationRevision = restoration?.revision ?? null;

  useLayoutEffect(() => {
    const isNewRestoration = restoration && appliedRestorationRef.current?.revision !== restoration.revision;
    if (isNewRestoration) {
      setFrameOverrides(restoration.frameOverrides);
      appliedRestorationRef.current = {
        revision: restoration.revision,
        source: spriteSheetImage,
        cols: sliceSettings.cols,
        rows: sliceSettings.rows,
      };
    } else {
      setFrameOverrides([]);
      if (!restoration) appliedRestorationRef.current = null;
    }
    lastAlignedSheetRef.current = null;
  }, [spriteSheetImage, sliceSettings.cols, sliceSettings.rows, restoration]);

  useLayoutEffect(() => {
    sliceSettingsRef.current = sliceSettings;
  }, [sliceSettings]);

  // Get the actual chroma key color based on selection
  const activeChromaKeyColor = CHROMA_KEY_COLORS[chromaKeyColor];

  // Process sprite sheet: remove chroma key background first
  useLayoutEffect(() => {
    if (spriteSheetImage && mode === 'sheet') {
      const controller = new AbortController();
      setProcessedSpriteSheet(null); // Reset while processing
      setChromaKeyProgress(0);
      setIsProcessingChromaKey(true);
      
      const processImage = async () => {
        try {
          logger.debug(`Starting chroma key removal with Web Worker (color: ${chromaKeyColor})`);
          // Step 1: Remove chroma key with fuzz tolerance using Web Worker
          const chromaKeyRemoved = await removeChromaKeyWithWorker(
            spriteSheetImage,
            activeChromaKeyColor,
            CHROMA_KEY_FUZZ,
            (progress) => {
              if (!controller.signal.aborted) setChromaKeyProgress(progress);
            },
            undefined,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          logger.debug('Chroma key removal completed');
          setProcessedSpriteSheet(chromaKeyRemoved);
          setChromaKeyProgress(100);
        } catch (e) {
          if (controller.signal.aborted || isAbortError(e)) return;
          logger.error('Chroma key removal failed', e);
          // Fallback to original image if processing fails
          setProcessedSpriteSheet(spriteSheetImage);
        } finally {
          if (!controller.signal.aborted) setIsProcessingChromaKey(false);
        }
      };
      processImage();
      return () => controller.abort();
    } else {
      setProcessedSpriteSheet(null);
      setChromaKeyProgress(0);
      setIsProcessingChromaKey(false);
    }
    return undefined;
  }, [spriteSheetImage, mode, chromaKeyColor, activeChromaKeyColor, restorationRevision]);

  // Re-slice when Slice Settings, Toggle or Image updates
  useLayoutEffect(() => {
    if (processedSpriteSheet && mode === 'sheet') {
      let cancelled = false;
      const reSlice = async () => {
        try {
          const mapFrames = slicePipeline?.mapFramesAfterSlice;
          let frames = await sliceSheetWithSettings(processedSpriteSheet, sliceSettingsRef.current, {
            frameOverrides,
            chromaKeyColor,
            threshold: BACKGROUND_REMOVAL_THRESHOLD,
          });
          if (cancelled) return;
          if (mapFrames) {
            frames = await mapFrames(frames);
          }
          if (!cancelled) {
            setGeneratedFrames(frames);
            setCompletedRestorationRevision(restorationRevision);
          }
        } catch (e) {
          if (!cancelled) logger.error('Re-slice failed', e);
        }
      };
      const timer = setTimeout(reSlice, DEBOUNCE_DELAY);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      // Clear frames when resetting the sheet or switching away from sheet mode.
      setGeneratedFrames([]);
      setProcessedSpriteSheet(null);
    }
    return undefined;
  }, [
    removeBackground,
    processedSpriteSheet,
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
    sliceSettings.sliceMode,
    sliceSettings.inferredCellRects,
    sliceSettings.manualXBounds,
    sliceSettings.manualYBounds,
    frameOverrides,
    mode,
    chromaKeyColor,
    slicePipeline?.mapFramesAfterSlice,
    slicePipeline?.slicePipelineRevision,
    restorationRevision,
  ]);

  // Run smart align once after generation when slice settings were auto-optimized
  useLayoutEffect(() => {
    const settings = sliceSettingsRef.current;
    const restored = appliedRestorationRef.current;
    if (restored && restored.revision === restorationRevision &&
        restored.source === spriteSheetImage && restored.cols === settings.cols && restored.rows === settings.rows) return;
    if (
      mode !== 'sheet' ||
      !processedSpriteSheet ||
      generatedFrames.length === 0 ||
      sheetDimensions.width <= 0 ||
      sheetDimensions.height <= 0 ||
      lastAlignedSheetRef.current === processedSpriteSheet
    ) {
      return;
    }
    if (settings.sliceMode === 'inferred') return; // Inferred grid uses explicit rects, skip smart align
    if (settings.sliceMode === 'manual') return; // User-drawn bounds — don't auto-shift
    if (settings.sliceMode === 'rects') return; // User marquee boxes — don't auto-shift
    const opt = settings.autoOptimized;
    if (!opt?.paddingX || !opt?.paddingY || !opt?.shiftX || !opt?.shiftY) {
      return;
    }
    const padding = getEffectivePadding(settings);
    const cellRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const n = settings.cols * settings.rows;
    for (let i = 0; i < n; i++) {
      const rect = getCellRectForFrame(
        sheetDimensions.width,
        sheetDimensions.height,
        settings.cols,
        settings.rows,
        settings.paddingX,
        settings.paddingY,
        settings.shiftX,
        settings.shiftY,
        i,
        padding
      );
      if (rect) cellRects.push(rect);
    }
    if (cellRects.length !== n) return;

    let cancelled = false;
    (async () => {
      try {
        const offsets = await smartAutoAlignFrames(
          processedSpriteSheet,
          cellRects,
          1,
          {
            alignMode: 'core',
            temporalSmoothing: 0.85,
            anchorFrame: 0,
            lockAllFramesToAnchor: true
          }
        );
        if (cancelled) return;
        setFrameOverrides(offsets.map((o) => ({ offsetX: o.offsetX, offsetY: o.offsetY, scale: 1 })));
        lastAlignedSheetRef.current = processedSpriteSheet;
      } catch (e) {
        logger.error('Smart align on load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    processedSpriteSheet,
    generatedFrames.length,
    sheetDimensions.width,
    sheetDimensions.height,
    sliceSettings.cols,
    sliceSettings.rows,
    sliceSettings.paddingX,
    sliceSettings.paddingY,
    sliceSettings.shiftX,
    sliceSettings.shiftY,
    sliceSettings.paddingLeft,
    sliceSettings.paddingRight,
    sliceSettings.paddingTop,
    sliceSettings.paddingBottom,
    sliceSettings.autoOptimized?.paddingX,
    sliceSettings.autoOptimized?.paddingY,
    sliceSettings.autoOptimized?.shiftX,
    sliceSettings.autoOptimized?.shiftY,
    sliceSettings.sliceMode,
    restorationRevision,
    spriteSheetImage,
  ]);

  // Update dimensions when processed sprite sheet is ready
  useLayoutEffect(() => {
    if (processedSpriteSheet) {
      const img = new Image();
      img.onload = () => {
        setSheetDimensions({
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = () => {
        logger.error('Failed to load processed sprite sheet');
      };
      img.src = processedSpriteSheet;
      return () => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      };
    }
    return undefined;
  }, [processedSpriteSheet]);

  const handleImageLoad = useMemo(
    () => (e: React.SyntheticEvent<HTMLImageElement>) => {
      // Only update dimensions if we don't have processed sprite sheet yet
      if (!processedSpriteSheet) {
        setSheetDimensions({
          width: e.currentTarget.naturalWidth,
          height: e.currentTarget.naturalHeight,
        });
      }
    },
    [processedSpriteSheet]
  );

  return {
    generatedFrames,
    setGeneratedFrames,
    sheetDimensions,
    setSheetDimensions,
    handleImageLoad,
    processedSpriteSheet, // The chroma-key-removed version for display
    chromaKeyProgress, // Progress of chroma key removal (0-100)
    isProcessingChromaKey, // Whether chroma key removal is in progress
    frameOverrides,
    setFrameOverrides,
    completedRestorationRevision,
  };
};
