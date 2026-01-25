import { useState, useEffect, useMemo } from 'react';
import { sliceSpriteSheet, SliceSettings, removeChromaKey } from '../utils/imageUtils';
import { BACKGROUND_REMOVAL_THRESHOLD, DEBOUNCE_DELAY, CHROMA_KEY_COLOR, CHROMA_KEY_FUZZ } from '../utils/constants';

/**
 * Custom hook for managing sprite sheet slicing and frame generation.
 * Automatically re-slices the sprite sheet when settings change.
 * 
 * @param spriteSheetImage - Base64 encoded sprite sheet image
 * @param sliceSettings - Configuration for slicing (cols, rows, padding, shift)
 * @param removeBackground - Whether to remove white/light backgrounds
 * @param mode - Current generation mode ('frame' or 'sheet')
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
 *   config.mode
 * );
 * ```
 */
export const useSpriteSheet = (
  spriteSheetImage: string | null,
  sliceSettings: SliceSettings,
  removeBackground: boolean,
  mode: 'frame' | 'sheet'
) => {
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
  const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);

  // Process sprite sheet: remove chroma key background first
  useEffect(() => {
    if (spriteSheetImage && mode === 'sheet') {
      const processImage = async () => {
        try {
          // Step 1: Remove chroma key (magenta #FF00FF) with fuzz tolerance
          // This is the "correct" background removal similar to ImageMagick
          const chromaKeyRemoved = await removeChromaKey(
            spriteSheetImage,
            CHROMA_KEY_COLOR,
            CHROMA_KEY_FUZZ
          );
          setProcessedSpriteSheet(chromaKeyRemoved);
        } catch (e) {
          console.error('Chroma key removal failed', e);
          // Fallback to original image if processing fails
          setProcessedSpriteSheet(spriteSheetImage);
        }
      };
      processImage();
    } else {
      setProcessedSpriteSheet(null);
    }
  }, [spriteSheetImage, mode]);

  // Re-slice when Slice Settings, Toggle or Image updates
  useEffect(() => {
    if (processedSpriteSheet && mode === 'sheet') {
      const reSlice = async () => {
        try {
          // Step 2: Slice the processed (chroma-key-removed) sprite sheet
          // No need for additional background removal since it's already processed
          const frames = await sliceSpriteSheet(
            processedSpriteSheet,
            sliceSettings.cols,
            sliceSettings.rows,
            sliceSettings.paddingX,
            sliceSettings.paddingY,
            sliceSettings.shiftX,
            sliceSettings.shiftY,
            false, // No additional white background removal needed
            BACKGROUND_REMOVAL_THRESHOLD
          );
          setGeneratedFrames(frames);
        } catch (e) {
          console.error('Re-slice failed', e);
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
  }, [
    removeBackground,
    processedSpriteSheet,
    sliceSettings.cols,
    sliceSettings.rows,
    sliceSettings.paddingX,
    sliceSettings.paddingY,
    sliceSettings.shiftX,
    sliceSettings.shiftY,
    mode,
  ]);

  const handleImageLoad = useMemo(
    () => (e: React.SyntheticEvent<HTMLImageElement>) => {
      setSheetDimensions({
        width: e.currentTarget.naturalWidth,
        height: e.currentTarget.naturalHeight,
      });
    },
    []
  );

  return {
    generatedFrames,
    setGeneratedFrames,
    sheetDimensions,
    setSheetDimensions,
    handleImageLoad,
    processedSpriteSheet, // The chroma-key-removed version for display
  };
};
