/**
 * Auto-optimize slice parameters by analyzing sprite sheet content boundaries.
 * Detects content edges and computes four-edge padding and shift.
 */

import { logger } from './logger';

export interface OptimizedSliceResult {
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  shiftX: number;
  shiftY: number;
}

/**
 * Automatically optimizes slice settings by analyzing the sprite sheet image.
 * Detects content boundaries and calculates optimal padding and shift values.
 *
 * @param base64Image - Base64 encoded sprite sheet image
 * @param cols - Number of columns in the grid
 * @param rows - Number of rows in the grid
 * @returns Promise resolving to optimized slice settings
 */
export const optimizeSliceSettings = async (
  base64Image: string,
  cols: number,
  rows: number
): Promise<OptimizedSliceResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          reject(new Error('Canvas context creation failed'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const isTransparent = (r: number, g: number, b: number, a: number) => {
          if (a < 10) return true;
          if (r > 180 && g < 100 && b > 100) return true;
          if (r < 30 && g < 30 && b < 30) return true;
          return false;
        };

        let topPadding = 0;
        for (let y = 0; y < height; y++) {
          let hasContent = false;
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            topPadding = y;
            break;
          }
        }

        let bottomPadding = 0;
        for (let y = height - 1; y >= 0; y--) {
          let hasContent = false;
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            bottomPadding = height - 1 - y;
            break;
          }
        }

        let leftPadding = 0;
        for (let x = 0; x < width; x++) {
          let hasContent = false;
          for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            leftPadding = x;
            break;
          }
        }

        let rightPadding = 0;
        for (let x = width - 1; x >= 0; x--) {
          let hasContent = false;
          for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            rightPadding = width - 1 - x;
            break;
          }
        }

        const paddingCapX = Math.floor(width * 0.2);
        const paddingCapY = Math.floor(height * 0.2);
        const paddingLeft = Math.max(0, Math.min(leftPadding, paddingCapX));
        const paddingRight = Math.max(0, Math.min(rightPadding, paddingCapX));
        const paddingTop = Math.max(0, Math.min(topPadding, paddingCapY));
        const paddingBottom = Math.max(0, Math.min(bottomPadding, paddingCapY));

        const effectiveWidth = width - paddingLeft - paddingRight;
        const effectiveHeight = height - paddingTop - paddingBottom;
        const gridCenterX = paddingLeft + effectiveWidth / 2;
        const gridCenterY = paddingTop + effectiveHeight / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        const optimalShiftX = Math.round(centerX - gridCenterX);
        const optimalShiftY = Math.round(centerY - gridCenterY);

        const shiftCap = Math.max(100, Math.min(width, height) * 0.15);
        const shiftX = Math.max(-shiftCap, Math.min(shiftCap, optimalShiftX));
        const shiftY = Math.max(-shiftCap, Math.min(shiftCap, optimalShiftY));

        logger.debug('Auto-optimized slice settings (four-edge)', {
          paddingLeft,
          paddingRight,
          paddingTop,
          paddingBottom,
          shiftX,
          shiftY,
          original: { left: leftPadding, right: rightPadding, top: topPadding, bottom: bottomPadding },
        });

        resolve({ paddingLeft, paddingRight, paddingTop, paddingBottom, shiftX, shiftY });
      } catch (error) {
        logger.error('Auto-optimization failed', error);
        resolve({
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          shiftX: 0,
          shiftY: 0,
        });
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for optimization'));
    };

    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};
