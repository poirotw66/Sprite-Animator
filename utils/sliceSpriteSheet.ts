/**
 * Grid-based sprite sheet slicing and cell rect calculation.
 */

import type { ChromaKeyColorType } from '../types';
import {
  type FrameOverride,
  type PaddingFour,
} from './spriteSlicing';

/**
 * Slices a sprite sheet image into multiple individual frame images with integer coordinates.
 *
 * @param base64Image - Base64 encoded sprite sheet image
 * @param cols - Number of columns in the grid
 * @param rows - Number of rows in the grid
 * @param paddingX - Horizontal padding
 * @param paddingY - Vertical padding
 * @param shiftX - Horizontal shift offset
 * @param shiftY - Vertical shift offset
 * @param removeBg - Whether to remove white/light backgrounds (legacy)
 * @param threshold - Color threshold for background removal (default: 230)
 * @param frameOverrides - Per-frame offset/scale overrides
 * @param chromaKeyColor - Chroma key color type (unused here; chroma key is applied before slicing)
 * @param paddingFour - Optional four-edge padding
 * @returns Promise resolving to an array of base64 encoded frame images
 */
export const sliceSpriteSheet = async (
  base64Image: string,
  cols: number,
  rows: number,
  paddingX: number,
  paddingY: number,
  shiftX: number,
  shiftY: number,
  removeBg: boolean,
  threshold: number = 230,
  frameOverrides?: FrameOverride[],
  _chromaKeyColor: ChromaKeyColorType = 'green',
  paddingFour?: PaddingFour
): Promise<string[]> => {
  const left = paddingFour?.left ?? paddingX;
  const right = paddingFour?.right ?? paddingX;
  const top = paddingFour?.top ?? paddingY;
  const bottom = paddingFour?.bottom ?? paddingY;

  return new Promise((resolve, reject) => {
    if (cols <= 0 || rows <= 0 || !Number.isInteger(cols) || !Number.isInteger(rows)) {
      reject(new Error(`Invalid grid dimensions: cols=${cols}, rows=${rows}. Must be positive integers.`));
      return;
    }
    if (left < 0 || right < 0 || top < 0 || bottom < 0) {
      reject(new Error(`Invalid padding: left=${left}, right=${right}, top=${top}, bottom=${bottom}. Must be non-negative.`));
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const frames: string[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {
          willReadFrequently: true,
          alpha: true,
          desynchronized: false,
        }) as CanvasRenderingContext2D | null;

        if (!ctx) {
          reject(new Error('Canvas context creation failed. Browser may not support canvas.'));
          return;
        }

        const totalWidth = img.width;
        const totalHeight = img.height;

        if (totalWidth <= 0 || totalHeight <= 0) {
          reject(new Error(`Invalid image dimensions: ${totalWidth}x${totalHeight}`));
          return;
        }

        let startX = Math.round(left + shiftX);
        let startY = Math.round(top + shiftY);
        startX = Math.max(0, Math.min(startX, totalWidth - 1));
        startY = Math.max(0, Math.min(startY, totalHeight - 1));
        const effectiveWidth = totalWidth - left - right;
        const effectiveHeight = totalHeight - top - bottom;

        if (effectiveWidth <= 0 || effectiveHeight <= 0) {
          reject(new Error(`Invalid effective area: ${effectiveWidth}x${effectiveHeight}. Please adjust padding or shift values.`));
          return;
        }

        const cellWidth = effectiveWidth / cols;
        const cellHeight = effectiveHeight / rows;
        const frameWidth = Math.round(cellWidth);
        const frameHeight = Math.round(cellHeight);

        if (frameWidth <= 0 || frameHeight <= 0) {
          reject(new Error(`Invalid frame dimensions: ${frameWidth}x${frameHeight}`));
          return;
        }

        canvas.width = frameWidth;
        canvas.height = frameHeight;
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = 'low';

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const frameIndex = r * cols + c;
            const override = frameOverrides?.[frameIndex];

            const scale = Math.max(0.25, Math.min(1, override?.scale ?? 1));
            const cropW = cellWidth * scale;
            const cropH = cellHeight * scale;
            const offX = override?.offsetX ?? 0;
            const offY = override?.offsetY ?? 0;

            const baseSx = startX + c * cellWidth;
            const baseSy = startY + r * cellHeight;
            const sx = baseSx + (cellWidth - cropW) / 2 + offX;
            const sy = baseSy + (cellHeight - cropH) / 2 + offY;

            const srcLeft = Math.max(0, sx);
            const srcTop = Math.max(0, sy);
            const srcRight = Math.min(totalWidth, sx + cropW);
            const srcBottom = Math.min(totalHeight, sy + cropH);
            const srcW = srcRight - srcLeft;
            const srcH = srcBottom - srcTop;

            ctx.clearRect(0, 0, frameWidth, frameHeight);
            if (srcW > 0 && srcH > 0) {
              const dstX = ((srcLeft - sx) / cropW) * frameWidth;
              const dstY = ((srcTop - sy) / cropH) * frameHeight;
              const dstW = (srcW / cropW) * frameWidth;
              const dstH = (srcH / cropH) * frameHeight;
              ctx.drawImage(
                img,
                srcLeft, srcTop, srcW, srcH,
                dstX, dstY, dstW, dstH
              );
            }

            if (removeBg) {
              const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
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
            }

            frames.push(canvas.toDataURL('image/png'));
          }
        }

        resolve(frames);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`Slicing failed: ${String(error)}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load sprite sheet image. The image may be corrupted or in an unsupported format.'));
    };

    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};

/**
 * Returns the source rectangle (in sheet pixel coords) for a given frame index.
 * Uses the same formulas as sliceSpriteSheet so the crop box aligns with actual slicing.
 */
export const getCellRectForFrame = (
  sheetWidth: number,
  sheetHeight: number,
  cols: number,
  rows: number,
  paddingX: number,
  paddingY: number,
  shiftX: number,
  shiftY: number,
  frameIndex: number,
  paddingFour?: PaddingFour
): { x: number; y: number; width: number; height: number } | null => {
  if (frameIndex < 0 || frameIndex >= cols * rows) return null;
  const left = paddingFour?.left ?? paddingX;
  const right = paddingFour?.right ?? paddingX;
  const top = paddingFour?.top ?? paddingY;
  const bottom = paddingFour?.bottom ?? paddingY;
  let startX = Math.round(left + shiftX);
  let startY = Math.round(top + shiftY);
  startX = Math.max(0, Math.min(startX, sheetWidth - 1));
  startY = Math.max(0, Math.min(startY, sheetHeight - 1));
  const effectiveWidth = sheetWidth - left - right;
  const effectiveHeight = sheetHeight - top - bottom;
  if (effectiveWidth <= 0 || effectiveHeight <= 0) return null;
  const cellWidth = effectiveWidth / cols;
  const cellHeight = effectiveHeight / rows;
  const r = Math.floor(frameIndex / cols);
  const c = frameIndex % cols;
  return {
    x: startX + c * cellWidth,
    y: startY + r * cellHeight,
    width: cellWidth,
    height: cellHeight,
  };
};
