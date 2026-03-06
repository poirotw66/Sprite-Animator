/**
 * Cell cropping and template-match offset search for sprite sheets.
 */

import { getErrorMessage } from '../types/errors';

const TEMPLATE_MATCH_OFFSET_CLAMP = 500;

/**
 * Crops one cell from the sheet using the same logic as sliceSpriteSheet.
 * Used for template-matching search. No post-processing.
 */
export function cropCellFromImage(
  img: HTMLImageElement,
  cellRect: { x: number; y: number; width: number; height: number },
  offsetX: number,
  offsetY: number,
  scale: number,
  sheetWidth: number,
  sheetHeight: number
): ImageData {
  const cellWidth = cellRect.width;
  const cellHeight = cellRect.height;
  const frameW = Math.round(cellWidth);
  const frameH = Math.round(cellHeight);
  const s = Math.max(0.25, Math.min(1, scale));
  const cropW = cellWidth * s;
  const cropH = cellHeight * s;
  const sx = cellRect.x + (cellWidth - cropW) / 2 + offsetX;
  const sy = cellRect.y + (cellHeight - cropH) / 2 + offsetY;
  const srcLeft = Math.max(0, sx);
  const srcTop = Math.max(0, sy);
  const srcRight = Math.min(sheetWidth, sx + cropW);
  const srcBottom = Math.min(sheetHeight, sy + cropH);
  const srcW = srcRight - srcLeft;
  const srcH = srcBottom - srcTop;

  const canvas = document.createElement('canvas');
  canvas.width = frameW;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new ImageData(1, 1);
  ctx.imageSmoothingEnabled = false;
  if (srcW > 0 && srcH > 0) {
    const dstX = ((srcLeft - sx) / cropW) * frameW;
    const dstY = ((srcTop - sy) / cropH) * frameH;
    const dstW = (srcW / cropW) * frameW;
    const dstH = (srcH / cropH) * frameH;
    ctx.drawImage(img, srcLeft, srcTop, srcW, srcH, dstX, dstY, dstW, dstH);
  }
  return ctx.getImageData(0, 0, frameW, frameH);
}

function computeTemplateMatchScore(ref: ImageData, cand: ImageData): number {
  const DS = 32;
  let sumMin = 0;
  let sumRef = 0;
  for (let j = 0; j < DS; j++) {
    for (let i = 0; i < DS; i++) {
      const ri = Math.min(ref.width - 1, ((i * ref.width) / DS) | 0);
      const rj = Math.min(ref.height - 1, ((j * ref.height) / DS) | 0);
      const ci = Math.min(cand.width - 1, ((i * cand.width) / DS) | 0);
      const cj = Math.min(cand.height - 1, ((j * cand.height) / DS) | 0);
      const rA = ref.data[(rj * ref.width + ri) * 4 + 3];
      const cA = cand.data[(cj * cand.width + ci) * 4 + 3];
      sumMin += Math.min(rA, cA);
      sumRef += rA;
    }
  }
  return sumMin / (sumRef + 1e-6);
}

function runTemplateSearch(
  img: HTMLImageElement,
  cellRect: { x: number; y: number; width: number; height: number },
  refImageData: ImageData,
  scale: number,
  sheetWidth: number,
  sheetHeight: number,
  opts?: { prevOffsetX: number; prevOffsetY: number; maxDelta: number }
): { offsetX: number; offsetY: number } {
  const STEP = 2;
  let oxMin: number, oxMax: number, oyMin: number, oyMax: number;
  if (opts && opts.maxDelta > 0) {
    oxMin = opts.prevOffsetX - opts.maxDelta;
    oxMax = opts.prevOffsetX + opts.maxDelta;
    oyMin = opts.prevOffsetY - opts.maxDelta;
    oyMax = opts.prevOffsetY + opts.maxDelta;
  } else {
    const R = Math.min(80, Math.floor(cellRect.width / 2));
    oxMin = -R;
    oxMax = R;
    oyMin = -R;
    oyMax = R;
  }

  let bestScore = -1;
  let bestOx = opts?.prevOffsetX ?? 0;
  let bestOy = opts?.prevOffsetY ?? 0;

  for (let oy = oyMin; oy <= oyMax; oy += STEP) {
    for (let ox = oxMin; ox <= oxMax; ox += STEP) {
      const cand = cropCellFromImage(img, cellRect, ox, oy, scale, sheetWidth, sheetHeight);
      const score = computeTemplateMatchScore(refImageData, cand);
      if (score > bestScore) {
        bestScore = score;
        bestOx = ox;
        bestOy = oy;
      }
    }
  }

  for (const dox of [-2, -1, 0, 1, 2]) {
    for (const doy of [-2, -1, 0, 1, 2]) {
      if (dox === 0 && doy === 0) continue;
      const ox = bestOx + dox;
      const oy = bestOy + doy;
      if (ox < oxMin || ox > oxMax || oy < oyMin || oy > oyMax) continue;
      const cand = cropCellFromImage(img, cellRect, ox, oy, scale, sheetWidth, sheetHeight);
      const score = computeTemplateMatchScore(refImageData, cand);
      if (score > bestScore) {
        bestScore = score;
        bestOx = ox;
        bestOy = oy;
      }
    }
  }

  bestOx = Math.max(-TEMPLATE_MATCH_OFFSET_CLAMP, Math.min(TEMPLATE_MATCH_OFFSET_CLAMP, bestOx));
  bestOy = Math.max(-TEMPLATE_MATCH_OFFSET_CLAMP, Math.min(TEMPLATE_MATCH_OFFSET_CLAMP, bestOy));
  return { offsetX: bestOx, offsetY: bestOy };
}

/**
 * Finds (offsetX, offsetY) that best aligns the cell crop with the reference image
 * by template matching (alpha overlap).
 */
export const getBestOffsetByTemplateMatch = async (
  sheetBase64OrImage: string | HTMLImageElement,
  cellRect: { x: number; y: number; width: number; height: number },
  refImageData: ImageData,
  scale: number,
  sheetWidth: number,
  sheetHeight: number,
  opts?: { prevOffsetX: number; prevOffsetY: number; maxDelta: number }
): Promise<{ offsetX: number; offsetY: number }> => {
  if (typeof sheetBase64OrImage !== 'string') {
    try {
      return Promise.resolve(
        runTemplateSearch(sheetBase64OrImage, cellRect, refImageData, scale, sheetWidth, sheetHeight, opts)
      );
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        resolve(
          runTemplateSearch(img, cellRect, refImageData, scale, sheetWidth, sheetHeight, opts)
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load sprite sheet for template match'));
    img.crossOrigin = 'anonymous';
    img.src = sheetBase64OrImage;
  });
};
