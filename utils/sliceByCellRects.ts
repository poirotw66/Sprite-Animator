/**
 * Slice a sprite sheet by explicit cell rectangles (inferred or irregular grids).
 */

import { getErrorMessage } from '../types/errors';

/**
 * Slices a sprite sheet by explicit cell rects (for inferred or irregular grids).
 *
 * @param base64Image - Base64 (or data URL) of the sprite sheet
 * @param cellRects - Array of { x, y, width, height } in sheet coords
 * @returns Promise resolving to array of base64 frame images
 */
export const sliceSpriteSheetByCellRects = async (
  base64Image: string,
  cellRects: Array<{ x: number; y: number; width: number; height: number }>
): Promise<string[]> => {
  if (cellRects.length === 0) return [];
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {
          willReadFrequently: true,
          alpha: true,
          desynchronized: false,
        }) as CanvasRenderingContext2D | null;
        if (!ctx) {
          reject(new Error('Canvas context creation failed'));
          return;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = 'low';
        const frames: string[] = [];
        for (const rect of cellRects) {
          const fw = Math.max(1, Math.round(rect.width));
          const fh = Math.max(1, Math.round(rect.height));
          canvas.width = fw;
          canvas.height = fh;
          const sx = Math.max(0, Math.min(rect.x, img.width - 1));
          const sy = Math.max(0, Math.min(rect.y, img.height - 1));
          const sw = Math.min(rect.width, img.width - sx);
          const sh = Math.min(rect.height, img.height - sy);
          if (sw > 0 && sh > 0) {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, fw, fh);
          }
          frames.push(canvas.toDataURL('image/png'));
        }
        resolve(frames);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for slice by rects'));
    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};
