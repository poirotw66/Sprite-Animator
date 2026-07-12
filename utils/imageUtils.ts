/**
 * Utility functions for image processing and manipulation.
 * Re-exports from focused modules: slice, optimize, crop, content analysis.
 *
 * @module imageUtils
 */

import { logger } from './logger';
import {
  getEffectivePadding,
  type FrameOverride,
  type PaddingFour,
  type SliceSettings,
} from './spriteSlicing';

export { getEffectivePadding };
export type { FrameOverride, PaddingFour, SliceSettings };
export {
  blendFrames,
  createLoopingAnimation,
  generateSmoothAnimation,
  interpolateFrames,
} from './imageInterpolation';
export type { InterpolationSettings } from './imageInterpolation';

export { sliceSpriteSheet, getCellRectForFrame } from './sliceSpriteSheet';
export { optimizeSliceSettings } from './optimizeSliceSettings';
export type { OptimizedSliceResult, OptimizeSliceOptions } from './optimizeSliceSettings';
export { mergeOptimizedPadding } from './optimizeSliceSettings';
export { sliceSpriteSheetByCellRects } from './sliceByCellRects';
export {
  analyzeFrameContent,
  smartAutoAlignFrames,
  getContentCentroidOffset,
} from './imageContentAnalysis';
export type { ContentAnalysis, SmartAutoAlignOptions } from './imageContentAnalysis';
export { cropCellFromImage, getBestOffsetByTemplateMatch } from './imageCrop';

/**
 * Loads multiple images and extracts their raw pixel data for export processing.
 */
export const loadImagesData = async (
  frames: string[]
): Promise<{
  imagesData: { data: Uint8ClampedArray; width: number; height: number }[];
  width: number;
  height: number;
}> => {
  const imagesData: { data: Uint8ClampedArray; width: number; height: number }[] = [];
  let width = 0;
  let height = 0;

  for (let i = 0; i < frames.length; i++) {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          if (width === 0) {
            width = img.width;
            height = img.height;
          }
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            imagesData.push({ data: imgData.data, width: img.width, height: img.height });
          }
          resolve();
        } catch (err) {
          logger.error(`Error processing frame ${i + 1}:`, err);
          reject(err);
        }
      };
      img.onerror = () => {
        logger.error(`Failed to load frame ${i + 1}`);
        reject(new Error(`Failed to load frame ${i + 1}`));
      };
      img.crossOrigin = 'anonymous';
      img.src = frames[i];
    });
  }
  return { imagesData, width, height };
};
