import { useState, useEffect, useMemo } from 'react';
import { sliceSpriteSheet, SliceSettings } from '../utils/imageUtils';
import { BACKGROUND_REMOVAL_THRESHOLD, DEBOUNCE_DELAY } from '../utils/constants';

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

  // Re-slice when Slice Settings, Toggle or Image updates
  useEffect(() => {
    if (spriteSheetImage && mode === 'sheet') {
      const reSlice = async () => {
        try {
          const frames = await sliceSpriteSheet(
            spriteSheetImage,
            sliceSettings.cols,
            sliceSettings.rows,
            sliceSettings.paddingX,
            sliceSettings.paddingY,
            sliceSettings.shiftX,
            sliceSettings.shiftY,
            removeBackground,
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
    }
  }, [
    removeBackground,
    spriteSheetImage,
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
  };
};
