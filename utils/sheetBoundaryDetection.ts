/**
 * Detect actual column/row seam positions on a chroma-keyed LINE sticker sheet.
 * Models often draw slightly uneven row/column sizes; equal division then clips
 * neighbouring stickers (e.g. row 2 includes the bottom of row 1).
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';

export interface DetectedSheetGrid {
  xBounds: number[];
  /** Median row seams across columns (straight horizontal guides). */
  yBounds: number[];
  /** Row seams detected independently per column (handles warped grids). */
  yBoundsPerColumn: number[][];
}

export interface DetectSheetGridOptions {
  /** Search radius as a fraction of cell size (default 0.15). */
  searchRadiusRatio?: number;
  /** Row seam search radius as a fraction of row height (default 0.18). */
  rowSearchRadiusRatio?: number;
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

function buildRowDensityProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  x1: number
): Float32Array {
  const profile = new Float32Array(height);
  const colW = Math.max(1, x1 - x0);
  for (let y = 0; y < height; y++) {
    let content = 0;
    for (let x = x0; x < x1; x++) {
      const offset = (y * width + x) * 4;
      if (!isSliceBackgroundPixel(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!)) {
        content++;
      }
    }
    profile[y] = content / colW;
  }
  return profile;
}

function smoothProfile(profile: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(profile.length);
  for (let i = 0; i < profile.length; i++) {
    let sum = 0;
    let count = 0;
    for (let d = -radius; d <= radius; d++) {
      const j = i + d;
      if (j >= 0 && j < profile.length) {
        sum += profile[j]!;
        count++;
      }
    }
    out[i] = count > 0 ? sum / count : profile[i]!;
  }
  return out;
}

function findBestBoundary(
  score: (pos: number) => number,
  theoretical: number,
  searchRadius: number,
  minPos: number,
  maxPos: number,
  preferLower = false
): number {
  let best = theoretical;
  let bestScore = preferLower ? Infinity : -1;
  const start = Math.max(minPos + 1, theoretical - searchRadius);
  const end = Math.min(maxPos - 1, theoretical + searchRadius);
  for (let pos = start; pos <= end; pos++) {
    const value = score(pos);
    if (preferLower ? value < bestScore : value > bestScore) {
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function detectColumnRowBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rows: number,
  x0: number,
  x1: number,
  radiusY: number,
  minCellPx: number
): number[] {
  const profile = smoothProfile(buildRowDensityProfile(data, width, height, x0, x1), 2);
  const bounds = [0];
  for (let r = 1; r < rows; r++) {
    const theoretical = Math.round((r * height) / rows);
    const y = findBestBoundary(
      (pos) => profile[pos] ?? 1,
      theoretical,
      radiusY,
      0,
      height,
      true
    );
    bounds.push(y);
  }
  bounds.push(height);
  return enforceMonotonic(bounds, minCellPx, height);
}

function buildMedianRowBounds(yBoundsPerColumn: number[][], rows: number, height: number): number[] {
  const yBounds = [0];
  for (let r = 1; r < rows; r++) {
    const samples = yBoundsPerColumn.map((col) => col[r]!).filter((y) => y > 0 && y < height);
    yBounds.push(samples.length > 0 ? median(samples) : Math.round((r * height) / rows));
  }
  yBounds.push(height);
  return yBounds;
}

/**
 * Locate internal grid seams by scanning for background-heavy lines near the
 * theoretical equal-split positions. Row seams are detected per column then
 * merged; use yBoundsPerColumn for per-cell slicing when rows are warped.
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
  const rowSearchRadiusRatio = options.rowSearchRadiusRatio ?? 0.18;
  const minCellPx = options.minCellPx ?? 48;
  const cellW = width / cols;
  const cellH = height / rows;
  const radiusX = Math.max(12, Math.floor(cellW * searchRadiusRatio));
  const radiusY = Math.max(10, Math.floor(cellH * rowSearchRadiusRatio));

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

  const enforcedXBounds = enforceMonotonic(xBounds, minCellPx, width);

  const yBoundsPerColumn: number[][] = [];
  for (let c = 0; c < cols; c++) {
    const x0 = enforcedXBounds[c]!;
    const x1 = enforcedXBounds[c + 1]!;
    yBoundsPerColumn.push(
      detectColumnRowBounds(data, width, height, rows, x0, x1, radiusY, minCellPx)
    );
  }

  const yBounds = enforceMonotonic(
    buildMedianRowBounds(yBoundsPerColumn, rows, height),
    minCellPx,
    height
  );

  return {
    xBounds: enforcedXBounds,
    yBounds,
    yBoundsPerColumn,
  };
}
