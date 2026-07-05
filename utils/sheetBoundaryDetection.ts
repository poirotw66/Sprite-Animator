/**
 * Detect actual column/row seam positions on a chroma-keyed LINE sticker sheet.
 * Models often draw slightly uneven row/column sizes; equal division then clips
 * neighbouring stickers (e.g. row 2 includes the bottom of row 1).
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';

export interface DetectedSheetGrid {
  xBounds: number[];
  yBounds: number[];
}

export interface DetectSheetGridOptions {
  /** Search radius as a fraction of cell size (default 0.15). */
  searchRadiusRatio?: number;
  /** Minimum detected cell size in px (default 48). */
  minCellPx?: number;
}

function scoreVerticalBackgroundLine(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number
): number {
  if (x < 0 || x >= width) return 0;
  let empty = 0;
  for (let y = 0; y < height; y++) {
    const offset = (y * width + x) * 4;
    if (isSliceBackgroundPixel(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!)) {
      empty++;
    }
  }
  return empty / height;
}

function scoreHorizontalBackgroundLine(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  y: number
): number {
  if (y < 0 || y >= height) return 0;
  let empty = 0;
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    if (isSliceBackgroundPixel(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!)) {
      empty++;
    }
  }
  return empty / width;
}

function findBestBoundary(
  score: (pos: number) => number,
  theoretical: number,
  searchRadius: number,
  minPos: number,
  maxPos: number
): number {
  let best = theoretical;
  let bestScore = -1;
  const start = Math.max(minPos + 1, theoretical - searchRadius);
  const end = Math.min(maxPos - 1, theoretical + searchRadius);
  for (let pos = start; pos <= end; pos++) {
    const value = score(pos);
    if (value > bestScore) {
      bestScore = value;
      best = pos;
    }
  }
  return best;
}

function enforceMonotonic(bounds: number[], minCellPx: number, maxEdge: number): number[] {
  const out = [...bounds];
  out[0] = 0;
  out[out.length - 1] = maxEdge;
  for (let i = 1; i < out.length - 1; i++) {
    const minV = out[i - 1]! + minCellPx;
    const maxV = maxEdge - (out.length - 1 - i) * minCellPx;
    out[i] = Math.max(minV, Math.min(maxV, out[i]!));
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i]! <= out[i - 1]!) {
      out[i] = Math.min(maxEdge, out[i - 1]! + minCellPx);
    }
  }
  out[out.length - 1] = maxEdge;
  return out;
}

/**
 * Locate internal grid seams by scanning for background-heavy lines near the
 * theoretical equal-split positions. Outer edges stay at 0 and width/height.
 */
export function detectSheetGridBoundaries(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number,
  options: DetectSheetGridOptions = {}
): DetectedSheetGrid {
  const searchRadiusRatio = options.searchRadiusRatio ?? 0.15;
  const minCellPx = options.minCellPx ?? 48;
  const cellW = width / cols;
  const cellH = height / rows;
  const radiusX = Math.max(12, Math.floor(cellW * searchRadiusRatio));
  const radiusY = Math.max(12, Math.floor(cellH * searchRadiusRatio));

  const xBounds = [0];
  for (let c = 1; c < cols; c++) {
    const theoretical = Math.round((c * width) / cols);
    const x = findBestBoundary(
      (pos) => scoreVerticalBackgroundLine(data, width, height, pos),
      theoretical,
      radiusX,
      0,
      width
    );
    xBounds.push(x);
  }
  xBounds.push(width);

  const yBounds = [0];
  for (let r = 1; r < rows; r++) {
    const theoretical = Math.round((r * height) / rows);
    const y = findBestBoundary(
      (pos) => scoreHorizontalBackgroundLine(data, width, height, pos),
      theoretical,
      radiusY,
      0,
      height
    );
    yBounds.push(y);
  }
  yBounds.push(height);

  return {
    xBounds: enforceMonotonic(xBounds, minCellPx, width),
    yBounds: enforceMonotonic(yBounds, minCellPx, height),
  };
}
