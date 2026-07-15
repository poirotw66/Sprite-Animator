/**
 * Browser ownership-based sprite sheet slicing.
 * Connects equal-grid bounds (with padding/shift) to sliceSheetByComponentOwnership
 * so art that crosses cell lines stays with its owner cell.
 */

import type { ChromaKeyColorType } from '../types';
import { getErrorMessage } from '../types/errors';
import {
  sliceSheetByComponentOwnership,
  type OwnershipSliceOptions,
} from './sheetComponentSlicer';
import type { FrameOverride, PaddingFour } from './spriteSlicing';

/** @internal exported for unit tests */
export function buildEqualGridBounds(
  totalWidth: number,
  totalHeight: number,
  cols: number,
  rows: number,
  paddingX: number,
  paddingY: number,
  shiftX: number,
  shiftY: number,
  paddingFour?: PaddingFour
): { xBounds: number[]; yBounds: number[] } {
  const left = paddingFour?.left ?? paddingX;
  const right = paddingFour?.right ?? paddingX;
  const top = paddingFour?.top ?? paddingY;
  const bottom = paddingFour?.bottom ?? paddingY;
  let startX = Math.round(left + shiftX);
  let startY = Math.round(top + shiftY);
  startX = Math.max(0, Math.min(startX, totalWidth - 1));
  startY = Math.max(0, Math.min(startY, totalHeight - 1));
  const effectiveWidth = totalWidth - left - right;
  const effectiveHeight = totalHeight - top - bottom;
  if (effectiveWidth <= 0 || effectiveHeight <= 0) {
    throw new Error(
      `Invalid effective area: ${effectiveWidth}x${effectiveHeight}. Adjust padding or shift.`
    );
  }
  const xBounds = Array.from({ length: cols + 1 }, (_, i) =>
    Math.round(startX + (i * effectiveWidth) / cols)
  );
  const yBounds = Array.from({ length: rows + 1 }, (_, i) =>
    Math.round(startY + (i * effectiveHeight) / rows)
  );
  xBounds[cols] = Math.min(totalWidth, startX + effectiveWidth);
  yBounds[rows] = Math.min(totalHeight, startY + effectiveHeight);
  return { xBounds, yBounds };
}

/**
 * When the sheet has little/no alpha (paper/grid mockups), knock down near-white
 * fill so connected-component ownership can see silhouettes.
 * Skipped if the sheet is already mostly transparent (post chroma-key).
 */
function knockDownOpaquePaperBackground(data: Uint8ClampedArray): void {
  const pixelCount = data.length / 4;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 20) transparent++;
  }
  if (transparent > pixelCount * 0.05) return;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    // Near-white / warm paper fill (not subject ink).
    if (r >= 228 && g >= 224 && b >= 210 && Math.min(r, g, b) >= 200) {
      data[i + 3] = 0;
    }
  }
}

function rgbaFrameToDataUrl(frame: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
  if (!ctx) {
    throw new Error('Canvas context creation failed');
  }
  const imageData = ctx.createImageData(frame.width, frame.height);
  imageData.data.set(frame.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Slice by equal grid bounds, then mask with component ownership so cross-cell
 * tails / motion lines stay with their owner (and are removed from neighbors).
 *
 * frameOverrides / cellInset are ignored — ownership defines the crop. Retained
 * in the signature so call sites can share equal-slice argument lists.
 */
export const sliceSpriteSheetByOwnership = async (
  base64Image: string,
  cols: number,
  rows: number,
  paddingX: number,
  paddingY: number,
  shiftX: number,
  shiftY: number,
  _removeBg: boolean,
  _threshold: number = 230,
  _frameOverrides?: FrameOverride[],
  _chromaKeyColor: ChromaKeyColorType = 'green',
  paddingFour?: PaddingFour,
  _cellInsetRatio: number = 0,
  ownershipOptions?: OwnershipSliceOptions
): Promise<string[]> => {
  if (cols <= 0 || rows <= 0 || !Number.isInteger(cols) || !Number.isInteger(rows)) {
    throw new Error(`Invalid grid dimensions: cols=${cols}, rows=${rows}`);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const totalWidth = img.width;
        const totalHeight = img.height;
        if (totalWidth <= 0 || totalHeight <= 0) {
          reject(new Error(`Invalid image dimensions: ${totalWidth}x${totalHeight}`));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
        if (!ctx) {
          reject(new Error('Canvas context creation failed'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, totalWidth, totalHeight);
        knockDownOpaquePaperBackground(imageData.data);

        const { xBounds, yBounds } = buildEqualGridBounds(
          totalWidth,
          totalHeight,
          cols,
          rows,
          paddingX,
          paddingY,
          shiftX,
          shiftY,
          paddingFour
        );

        const frames = sliceSheetByComponentOwnership(
          imageData.data,
          totalWidth,
          totalHeight,
          xBounds,
          yBounds,
          ownershipOptions
        );
        resolve(frames.map(rgbaFrameToDataUrl));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load sprite sheet for ownership slice'));
    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};
