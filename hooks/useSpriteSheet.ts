import { useState, useEffect, useMemo, useRef } from 'react';
import { sliceSpriteSheet, sliceSpriteSheetByCellRects, SliceSettings, FrameOverride, getEffectivePadding, getCellRectForFrame, smartAutoAlignFrames } from '../utils/imageUtils';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import { BACKGROUND_REMOVAL_THRESHOLD, DEBOUNCE_DELAY, CHROMA_KEY_COLORS, CHROMA_KEY_FUZZ } from '../utils/constants';
import { logger } from '../utils/logger';
import type { ChromaKeyColorType } from '../types';

/**
 * Custom hook for managing sprite sheet slicing and frame generation.
 * Automatically re-slices the sprite sheet when settings change.
 * 
 * @param spriteSheetImage - Base64 encoded sprite sheet image
 * @param sliceSettings - Configuration for slicing (cols, rows, padding, shift)
 * @param removeBackground - Whether to remove white/light backgrounds
 * @param mode - Current generation mode ('frame' or 'sheet')
 * @param chromaKeyColor - Which chroma key color to use ('magenta' or 'green')
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
 *   config.chromaKeyColor
 * );
 * ```
 */
export const useSpriteSheet = (
  spriteSheetImage: string | null,
  sliceSettings: SliceSettings,
  removeBackground: boolean,
  mode: 'frame' | 'sheet',
  chromaKeyColor: ChromaKeyColorType = 'green'
) => {
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
  const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
  const [chromaKeyProgress, setChromaKeyProgress] = useState<number>(0);
  const [isProcessingChromaKey, setIsProcessingChromaKey] = useState<boolean>(false);
  const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);
  const lastAlignedSheetRef = useRef<string | null>(null);

  // Get the actual chroma key color based on selection
  const activeChromaKeyColor = CHROMA_KEY_COLORS[chromaKeyColor];

  // Process sprite sheet: remove chroma key background first
  useEffect(() => {
    if (spriteSheetImage && mode === 'sheet') {
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
              setChromaKeyProgress(progress);
            }
          );
          logger.debug('Chroma key removal completed');
          setProcessedSpriteSheet(chromaKeyRemoved);
          setChromaKeyProgress(100);
        } catch (e) {
          logger.error('Chroma key removal failed', e);
          // Fallback to original image if processing fails
          setProcessedSpriteSheet(spriteSheetImage);
        } finally {
          setIsProcessingChromaKey(false);
        }
      };
      processImage();
    } else {
      setProcessedSpriteSheet(null);
      setChromaKeyProgress(0);
      setIsProcessingChromaKey(false);
    }
  }, [spriteSheetImage, mode, chromaKeyColor, activeChromaKeyColor]);

  // Re-slice when Slice Settings, Toggle or Image updates
  useEffect(() => {
    if (processedSpriteSheet && mode === 'sheet') {
      const reSlice = async () => {
        try {
          if (sliceSettings.sliceMode === 'inferred' && sliceSettings.inferredCellRects?.length) {
            const frames = await sliceSpriteSheetByCellRects(
              processedSpriteSheet,
              sliceSettings.inferredCellRects
            );
            setGeneratedFrames(frames);
          } else {
            const padding = getEffectivePadding(sliceSettings);
            const frames = await sliceSpriteSheet(
              processedSpriteSheet,
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
            setGeneratedFrames(frames);
          }
        } catch (e) {
          logger.error('Re-slice failed', e);
        }
      };
      const timer = setTimeout(reSlice, DEBOUNCE_DELAY);
      return () => clearTimeout(timer);
    } else if (mode !== 'sheet') {
      // Clear frames when switching away from sheet mode
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
    frameOverrides,
    mode,
  ]);

  // Reset per-frame overrides when image or grid dimensions change
  useEffect(() => {
    setFrameOverrides([]);
    lastAlignedSheetRef.current = null; // Allow smart align to run again for new sheet
  }, [processedSpriteSheet, sliceSettings.cols, sliceSettings.rows]);

  // Run smart align once after generation when slice settings were auto-optimized
  useEffect(() => {
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
    if (sliceSettings.sliceMode === 'inferred') return; // Inferred grid uses explicit rects, skip smart align
    const opt = sliceSettings.autoOptimized;
    if (!opt?.paddingX || !opt?.paddingY || !opt?.shiftX || !opt?.shiftY) {
      return;
    }
    const padding = getEffectivePadding(sliceSettings);
    const cellRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const n = sliceSettings.cols * sliceSettings.rows;
    for (let i = 0; i < n; i++) {
      const rect = getCellRectForFrame(
        sheetDimensions.width,
        sheetDimensions.height,
        sliceSettings.cols,
        sliceSettings.rows,
        sliceSettings.paddingX,
        sliceSettings.paddingY,
        sliceSettings.shiftX,
        sliceSettings.shiftY,
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
  ]);

  // Update dimensions when processed sprite sheet is ready
  useEffect(() => {
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
    }
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
  };
};
