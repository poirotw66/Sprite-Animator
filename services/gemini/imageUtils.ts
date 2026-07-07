/**
 * Image utilities: chroma key normalization and aspect ratio selection.
 */

import { logger } from '../../utils/logger';
import type { ChromaKeyColorType } from '../../types';
import { createAbortError, throwIfAborted } from '../../utils/abort';
import {
  CHROMA_BACKGROUND_NORMALIZE_TOLERANCE,
  normalizeChromaBackgroundInPlace,
} from '../../utils/normalizeChromaBackground';

/**
 * Normalizes background color in AI-generated images to exact chroma key color.
 * Replaces similar shades with the exact target so chroma key removal works.
 */
export async function normalizeBackgroundColor(
  base64Image: string,
  targetColor: { r: number; g: number; b: number },
  colorType: ChromaKeyColorType,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const handleAbort = () => {
      img.src = '';
      reject(createAbortError());
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    img.onload = () => {
      signal?.removeEventListener('abort', handleAbort);

      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const normalizedCount = normalizeChromaBackgroundInPlace(
        data,
        colorType,
        targetColor,
        CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
      );

      logger.debug('Color normalization completed', {
        totalPixels: data.length / 4,
        normalizedPixels: normalizedCount,
        percentage: ((normalizedCount / (data.length / 4)) * 100).toFixed(2) + '%',
      });

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      signal?.removeEventListener('abort', handleAbort);
      reject(new Error('Failed to load image for color normalization'));
    };
    img.src = base64Image;
  });
}

export {
  getBestAspectRatio,
  getLineStickerSpriteSheetAspectRatio,
  LINE_STICKER_SPRITE_SHEET_SIZE_PX,
} from '../../utils/lineStickerSheetAspect';
