/**
 * Auto-optimize slice parameters by analyzing sprite sheet content boundaries.
 * Detects outer margins and computes four-edge padding (conservative: no grid shift).
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';
import { logger } from './logger';

export interface OptimizedSliceResult {
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  shiftX: number;
  shiftY: number;
}

export interface OptimizeSliceOptions {
  /**
   * When true (default), only trim uniform outer margins and keep shift at 0.
   * Shifting the grid to center content often clips characters at sheet edges.
   */
  conservative?: boolean;
}

/** Padding/shift fields to merge into slice settings after auto-optimization. */
export function mergeOptimizedPadding(optimized: OptimizedSliceResult) {
  return {
    paddingLeft: optimized.paddingLeft,
    paddingRight: optimized.paddingRight,
    paddingTop: optimized.paddingTop,
    paddingBottom: optimized.paddingBottom,
    paddingX: Math.round((optimized.paddingLeft + optimized.paddingRight) / 2),
    paddingY: Math.round((optimized.paddingTop + optimized.paddingBottom) / 2),
    shiftX: optimized.shiftX,
    shiftY: optimized.shiftY,
    autoOptimized: {
      paddingX: true,
      paddingY: true,
      shiftX: true,
      shiftY: true,
    },
  };
}

export interface ContentMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function rowHasContent(
  data: Uint8ClampedArray,
  width: number,
  y: number
): boolean {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    if (!isSliceBackgroundPixel(data[idx]!, data[idx + 1]!, data[idx + 2]!, data[idx + 3]!)) {
      return true;
    }
  }
  return false;
}

function columnHasContent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number
): boolean {
  for (let y = 0; y < height; y++) {
    const idx = (y * width + x) * 4;
    if (!isSliceBackgroundPixel(data[idx]!, data[idx + 1]!, data[idx + 2]!, data[idx + 3]!)) {
      return true;
    }
  }
  return false;
}

/** Scan image pixels and return distance from each edge to the nearest non-background pixel. */
export function measureContentMargins(
  data: Uint8ClampedArray,
  width: number,
  height: number
): ContentMargins {
  let top = 0;
  for (let y = 0; y < height; y++) {
    if (rowHasContent(data, width, y)) {
      top = y;
      break;
    }
  }

  let bottom = 0;
  for (let y = height - 1; y >= 0; y--) {
    if (rowHasContent(data, width, y)) {
      bottom = height - 1 - y;
      break;
    }
  }

  let left = 0;
  for (let x = 0; x < width; x++) {
    if (columnHasContent(data, width, height, x)) {
      left = x;
      break;
    }
  }

  let right = 0;
  for (let x = width - 1; x >= 0; x--) {
    if (columnHasContent(data, width, height, x)) {
      right = width - 1 - x;
      break;
    }
  }

  return { left, right, top, bottom };
}

/**
 * Convert measured outer margins into slice padding/shift.
 * Uses conservative caps and a per-cell safety inset so auto-trim does not clip sticker art.
 */
export function computeOptimizedSliceFromMargins(
  width: number,
  height: number,
  cols: number,
  rows: number,
  margins: ContentMargins,
  options: OptimizeSliceOptions = {}
): OptimizedSliceResult {
  const conservative = options.conservative !== false;
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const paddingCapX = Math.floor(width * 0.12);
  const paddingCapY = Math.floor(height * 0.12);
  const safetyX = Math.max(3, Math.floor(cellWidth * 0.05));
  const safetyY = Math.max(3, Math.floor(cellHeight * 0.05));

  const trimLeft = (value: number, cap: number, safety: number) =>
    Math.max(0, Math.min(value, cap) - safety);
  const trimRight = trimLeft;

  const paddingLeft = trimLeft(margins.left, paddingCapX, safetyX);
  const paddingRight = trimRight(margins.right, paddingCapX, safetyX);
  const paddingTop = trimLeft(margins.top, paddingCapY, safetyY);
  const paddingBottom = trimRight(margins.bottom, paddingCapY, safetyY);

  if (conservative) {
    return {
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      shiftX: 0,
      shiftY: 0,
    };
  }

  const effectiveWidth = width - paddingLeft - paddingRight;
  const effectiveHeight = height - paddingTop - paddingBottom;
  const gridCenterX = paddingLeft + effectiveWidth / 2;
  const gridCenterY = paddingTop + effectiveHeight / 2;
  const optimalShiftX = Math.round(width / 2 - gridCenterX);
  const optimalShiftY = Math.round(height / 2 - gridCenterY);
  const shiftCapX = Math.max(4, Math.floor(cellWidth * 0.04));
  const shiftCapY = Math.max(4, Math.floor(cellHeight * 0.04));

  return {
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    shiftX: Math.max(-shiftCapX, Math.min(shiftCapX, optimalShiftX)),
    shiftY: Math.max(-shiftCapY, Math.min(shiftCapY, optimalShiftY)),
  };
}

/**
 * Automatically optimizes slice settings by analyzing the sprite sheet image.
 * Prefer a chroma-key-removed image when available for more stable margins.
 */
export const optimizeSliceSettings = async (
  base64Image: string,
  cols: number,
  rows: number,
  options: OptimizeSliceOptions = {}
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
        const margins = measureContentMargins(imageData.data, canvas.width, canvas.height);
        const result = computeOptimizedSliceFromMargins(
          canvas.width,
          canvas.height,
          cols,
          rows,
          margins,
          options
        );

        logger.debug('Auto-optimized slice settings (four-edge)', {
          ...result,
          measuredMargins: margins,
          conservative: options.conservative !== false,
        });

        resolve(result);
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
