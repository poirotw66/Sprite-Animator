/**
 * Content analysis for sprite sheet cells: bounding box, center of mass, core region.
 * Used for smart auto-align and centroid-based crop offset.
 */

import { getErrorMessage } from '../types/errors';

/** Clamp for centroid-derived offset to match OFFSET_MIN/MAX used in FrameGrid */
const CENTROID_OFFSET_CLAMP = 500;

/** Max pixels one frame may differ from the previous (keeps animation continuous, no drift) */
const MAX_DELTA_PER_FRAME = 10;

/**
 * Check if a pixel is likely chroma key background.
 * For content analysis only; actual chroma key removal is in chromaKeyWorker.
 */
const isChromaKeyPixel = (r: number, g: number, b: number, a: number): boolean => {
  if (a <= 20) return true;
  const isPureMagenta = r > 240 && g < 30 && b > 240 && Math.abs(r - b) < 20;
  const isPureGreen = g > 240 && r < 30 && b < 30;
  const isStandardGreen = g > 150 && g < 200 && r < 30 && b < 100 && (g - r) > 120 && (g - b) > 50;
  return isPureMagenta || isPureGreen || isStandardGreen;
};

export interface ContentAnalysis {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  centerOfMass: { x: number; y: number };
  coreCenter: { x: number; y: number };
  pixelCount: number;
  hasContent: boolean;
}

/**
 * Analyze content in a cell and return detailed bounding info.
 */
export const analyzeFrameContent = async (
  sheetBase64: string,
  cellRect: { x: number; y: number; width: number; height: number }
): Promise<ContentAnalysis> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const x0 = Math.max(0, Math.floor(cellRect.x));
        const y0 = Math.max(0, Math.floor(cellRect.y));
        const x1 = Math.min(img.width, Math.ceil(cellRect.x + cellRect.width));
        const y1 = Math.min(img.height, Math.ceil(cellRect.y + cellRect.height));

        const emptyResult: ContentAnalysis = {
          bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
          centerOfMass: { x: cellRect.width / 2, y: cellRect.height / 2 },
          coreCenter: { x: cellRect.width / 2, y: cellRect.height / 2 },
          pixelCount: 0,
          hasContent: false,
        };

        if (x1 <= x0 || y1 <= y0) {
          resolve(emptyResult);
          return;
        }

        const w = x1 - x0;
        const h = y1 - y0;
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(emptyResult);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(x0, y0, w, h);
        const data = imageData.data;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0, pixelCount = 0;

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const idx = (dy * w + dx) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (isChromaKeyPixel(r, g, b, a)) continue;
            const cellX = dx;
            const cellY = dy;
            minX = Math.min(minX, cellX);
            maxX = Math.max(maxX, cellX);
            minY = Math.min(minY, cellY);
            maxY = Math.max(maxY, cellY);
            sumX += cellX;
            sumY += cellY;
            pixelCount++;
          }
        }

        if (pixelCount === 0 || minX === Infinity) {
          resolve(emptyResult);
          return;
        }

        const centerOfMass = { x: sumX / pixelCount, y: sumY / pixelCount };
        const bounds = { minX, maxX, minY, maxY };

        const trunkTop = h * 0.30;
        const trunkBottom = h * 0.70;
        const trunkLeft = w * 0.42;
        const trunkRight = w * 0.58;

        const trunkXs: number[] = [];
        const trunkYs: number[] = [];
        for (let dy = 0; dy < h; dy++) {
          if (dy < trunkTop || dy > trunkBottom) continue;
          for (let dx = 0; dx < w; dx++) {
            if (dx < trunkLeft || dx > trunkRight) continue;
            const idx = (dy * w + dx) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (isChromaKeyPixel(r, g, b, a)) continue;
            trunkXs.push(dx);
            trunkYs.push(dy);
          }
        }
        let trunkCount = trunkXs.length;

        const median = (arr: number[]) => {
          if (arr.length === 0) return 0;
          const s = [...arr].sort((a, b) => a - b);
          const mid = (s.length - 1) / 2;
          const i = Math.floor(mid);
          return s.length % 2 === 1 ? s[i]! : (s[i]! + s[i + 1]!) / 2;
        };

        const trunkMinForMedian = 15;
        const outlierRadius = Math.min(w, h) * 0.22;
        if (trunkCount >= trunkMinForMedian && outlierRadius > 0) {
          const mx = median(trunkXs);
          const my = median(trunkYs);
          const inlierXs: number[] = [];
          const inlierYs: number[] = [];
          for (let k = 0; k < trunkXs.length; k++) {
            const dx = trunkXs[k]! - mx;
            const dy = trunkYs[k]! - my;
            if (dx * dx + dy * dy <= outlierRadius * outlierRadius) {
              inlierXs.push(trunkXs[k]!);
              inlierYs.push(trunkYs[k]!);
            }
          }
          if (inlierXs.length >= 8) {
            trunkXs.length = 0;
            trunkYs.length = 0;
            trunkXs.push(...inlierXs);
            trunkYs.push(...inlierYs);
            trunkCount = trunkXs.length;
          }
        }

        let coreCenter: { x: number; y: number };
        if (trunkCount >= trunkMinForMedian) {
          coreCenter = { x: median(trunkXs), y: median(trunkYs) };
        } else if (trunkCount >= 5) {
          const sumXTrunk = trunkXs.reduce((a, b) => a + b, 0);
          const sumYTrunk = trunkYs.reduce((a, b) => a + b, 0);
          coreCenter = { x: sumXTrunk / trunkCount, y: sumYTrunk / trunkCount };
        } else {
          const contentHeight = maxY - minY;
          const coreTop = minY + contentHeight * 0.2;
          const coreBottom = maxY - contentHeight * 0.2;
          let coreSumX = 0, coreSumY = 0, coreCount = 0;
          for (let dy = 0; dy < h; dy++) {
            if (dy < coreTop || dy > coreBottom) continue;
            for (let dx = 0; dx < w; dx++) {
              const idx = (dy * w + dx) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];
              if (isChromaKeyPixel(r, g, b, a)) continue;
              coreSumX += dx;
              coreSumY += dy;
              coreCount++;
            }
          }
          coreCenter = coreCount > 0
            ? { x: coreSumX / coreCount, y: coreSumY / coreCount }
            : centerOfMass;
        }

        resolve({
          bounds,
          centerOfMass,
          coreCenter,
          pixelCount,
          hasContent: true,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load sprite sheet for analysis'));
    img.crossOrigin = 'anonymous';
    img.src = sheetBase64;
  });
};

export interface SmartAutoAlignOptions {
  alignMode: 'core' | 'bounds' | 'mass';
  temporalSmoothing: number;
  anchorFrame: number;
  anchorOffset?: { offsetX: number; offsetY: number };
  maxDeltaPerFrame?: number;
  lockHorizontalToAnchor?: boolean;
  lockAllFramesToAnchor?: boolean;
}

/**
 * Smart auto-align all frames by analyzing content and finding optimal offsets.
 */
export const smartAutoAlignFrames = async (
  sheetBase64: string,
  cellRects: Array<{ x: number; y: number; width: number; height: number }>,
  _scale: number = 1,
  options: SmartAutoAlignOptions = { alignMode: 'core', temporalSmoothing: 0.85, anchorFrame: 0 }
): Promise<Array<{ offsetX: number; offsetY: number }>> => {
  const {
    alignMode,
    temporalSmoothing,
    anchorFrame,
    anchorOffset,
    maxDeltaPerFrame = MAX_DELTA_PER_FRAME,
    lockHorizontalToAnchor = alignMode === 'core',
    lockAllFramesToAnchor = alignMode === 'core',
  } = options;

  const analyses: ContentAnalysis[] = [];
  for (const cellRect of cellRects) {
    const analysis = await analyzeFrameContent(sheetBase64, cellRect);
    analyses.push(analysis);
  }

  const anchorIdx = Math.min(anchorFrame, analyses.length - 1);
  const anchorAnalysis = analyses[anchorIdx];

  if (!anchorAnalysis.hasContent) {
    return cellRects.map(() => ({ offsetX: 0, offsetY: 0 }));
  }

  const getRefPoint = (analysis: ContentAnalysis) => {
    switch (alignMode) {
      case 'core':
        return analysis.coreCenter;
      case 'mass':
        return analysis.centerOfMass;
      case 'bounds':
        return {
          x: (analysis.bounds.minX + analysis.bounds.maxX) / 2,
          y: (analysis.bounds.minY + analysis.bounds.maxY) / 2,
        };
    }
  };

  const anchorRef = getRefPoint(anchorAnalysis);
  const anchorCellWidth = cellRects[anchorIdx].width;
  const anchorCellHeight = cellRects[anchorIdx].height;

  const userAnchorOffset = anchorOffset ?? {
    offsetX: anchorRef.x - anchorCellWidth / 2,
    offsetY: anchorRef.y - anchorCellHeight / 2,
  };

  let rawOffsets = analyses.map((analysis, i) => {
    if (!analysis.hasContent) {
      return { offsetX: userAnchorOffset.offsetX, offsetY: userAnchorOffset.offsetY };
    }
    const ref = getRefPoint(analysis);
    const cellWidth = cellRects[i].width;
    const cellHeight = cellRects[i].height;

    if (i === anchorIdx) {
      return {
        offsetX: userAnchorOffset.offsetX,
        offsetY: userAnchorOffset.offsetY,
      };
    }

    const deltaX = (ref.x - cellWidth / 2) - (anchorRef.x - anchorCellWidth / 2);
    const deltaY = (ref.y - cellHeight / 2) - (anchorRef.y - anchorCellHeight / 2);
    const offsetX = userAnchorOffset.offsetX + deltaX;
    const offsetY = userAnchorOffset.offsetY + deltaY;
    return { offsetX, offsetY };
  });

  if (lockAllFramesToAnchor) {
    rawOffsets = rawOffsets.map(() => ({
      offsetX: userAnchorOffset.offsetX,
      offsetY: userAnchorOffset.offsetY,
    }));
  } else if (lockHorizontalToAnchor) {
    rawOffsets = rawOffsets.map((o) => ({
      offsetX: userAnchorOffset.offsetX,
      offsetY: o.offsetY,
    }));
  }

  let offsets = rawOffsets;
  if (temporalSmoothing > 0 && rawOffsets.length > 2) {
    offsets = rawOffsets.map((_, i) => {
      const prev = rawOffsets[Math.max(0, i - 1)];
      const curr = rawOffsets[i];
      const next = rawOffsets[Math.min(rawOffsets.length - 1, i + 1)];
      const smoothX = (lockAllFramesToAnchor || lockHorizontalToAnchor)
        ? userAnchorOffset.offsetX
        : curr.offsetX * (1 - temporalSmoothing) + (prev.offsetX + next.offsetX) / 2 * temporalSmoothing;
      const smoothY = lockAllFramesToAnchor
        ? userAnchorOffset.offsetY
        : curr.offsetY * (1 - temporalSmoothing) + (prev.offsetY + next.offsetY) / 2 * temporalSmoothing;
      return {
        offsetX: Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, smoothX)),
        offsetY: Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, smoothY)),
      };
    });
  }

  if (maxDeltaPerFrame > 0 && offsets.length > 1) {
    const clampDelta = (v: number, prevV: number, d: number) =>
      Math.max(prevV - d, Math.min(prevV + d, v));
    offsets = offsets.map((o, i) => {
      if (i === 0) return o;
      const prev = offsets[i - 1]!;
      return {
        offsetX: clampDelta(o.offsetX, prev.offsetX, maxDeltaPerFrame),
        offsetY: clampDelta(o.offsetY, prev.offsetY, maxDeltaPerFrame),
      };
    });
  }

  return offsets.map((o) => ({
    offsetX: Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, o.offsetX)),
    offsetY: Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, o.offsetY)),
  }));
};

/**
 * Computes the offset (offsetX, offsetY) so that the crop box centers on the
 * content bounding-box center within the given cell.
 */
export const getContentCentroidOffset = async (
  sheetBase64: string,
  cellRect: { x: number; y: number; width: number; height: number }
): Promise<{ offsetX: number; offsetY: number }> => {
  const analysis = await analyzeFrameContent(sheetBase64, cellRect);
  if (!analysis.hasContent) {
    return { offsetX: 0, offsetY: 0 };
  }
  const centerX = analysis.coreCenter.x;
  const centerY = analysis.coreCenter.y;
  let offsetX = centerX - cellRect.width / 2;
  let offsetY = centerY - cellRect.height / 2;
  offsetX = Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, offsetX));
  offsetY = Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, offsetY));
  return { offsetX, offsetY };
};
