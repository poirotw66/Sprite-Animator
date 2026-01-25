import { useState, useEffect, useMemo } from 'react';
import { sliceSpriteSheet, SliceSettings } from '../utils/imageUtils';
import { BACKGROUND_REMOVAL_THRESHOLD, DEBOUNCE_DELAY } from '../utils/constants';

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
