/**
 * Utility functions for image processing and manipulation.
 * Re-exports from focused modules: slice, optimize, crop, content analysis.
 *
 * @module imageUtils
 */

import { logger } from './logger';
import { removeChromaKeyWithWorker } from './chromaKeyProcessor';
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
export type { OptimizedSliceResult } from './optimizeSliceSettings';
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

/**
 * Removes the data URL prefix from a base64 encoded image string.
 */
export const cleanBase64 = (base64: string): string => {
  return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};

/**
 * Chroma key removal: delegates to chromaKeyProcessor (HSL-based, Web Worker, progress support).
 */
export const removeChromaKey = (
  base64Image: string,
  chromaKey: { r: number; g: number; b: number } = { r: 255, g: 0, b: 255 },
  fuzzPercent: number = 10
): Promise<string> => removeChromaKeyWithWorker(base64Image, chromaKey, fuzzPercent);

/**
 * Removes white/light background from an image (legacy method).
 */
export const removeWhiteBackground = async (
  base64Image: string,
  threshold: number = 230
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        if (red > threshold && green > threshold && blue > threshold) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
    img.src = base64Image;
  });
};
