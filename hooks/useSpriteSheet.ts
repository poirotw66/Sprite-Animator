import { useState, useEffect, useMemo } from 'react';
import { sliceSpriteSheet, SliceSettings, FrameOverride } from '../utils/imageUtils';
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
  chromaKeyColor: ChromaKeyColorType = 'magenta'
) => {
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
  const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
  const [chromaKeyProgress, setChromaKeyProgress] = useState<number>(0);
  const [isProcessingChromaKey, setIsProcessingChromaKey] = useState<boolean>(false);
  const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);

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
          // Step 2: Slice the processed (chroma-key-removed) sprite sheet
          // Chroma key removal is already done - just slice the frames
          const frames = await sliceSpriteSheet(
            processedSpriteSheet,
            sliceSettings.cols,
            sliceSettings.rows,
            sliceSettings.paddingX,
            sliceSettings.paddingY,
            sliceSettings.shiftX,
            sliceSettings.shiftY,
            false, // No additional background removal needed
            BACKGROUND_REMOVAL_THRESHOLD,
            frameOverrides
          );
          setGeneratedFrames(frames);
        } catch (e) {
          logger.error('Re-slice failed', e);
        }
      };
      // Small debounce to keep UI responsive while dragging sliders
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
    sliceSettings.shiftX,
    sliceSettings.shiftY,
    frameOverrides,
    mode,
  ]);

  // Reset per-frame overrides when image or grid dimensions change
  useEffect(() => {
    setFrameOverrides([]);
  }, [processedSpriteSheet, sliceSettings.cols, sliceSettings.rows]);

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
