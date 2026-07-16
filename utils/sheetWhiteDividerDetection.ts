/**
 * Detect visible grid divider lines (light or dark) on sticker sheets.
 * Slices between divider bands so the separator strips are excluded from stickers.
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';

export interface WhiteDividerBand {
  start: number;
  end: number;
  center: number;
}

export interface WhiteDividerGrid {
  verticalBands: Array<WhiteDividerBand | null>;
  horizontalBandsPerColumn: Array<Array<WhiteDividerBand | null>>;
}

export interface DetectWhiteDividerOptions {
  /** Min channel value for a near-white divider pixel (default 200). */
  whiteMinChannel?: number;
  /** Min mean RGB for divider pixels (default 235). */
  whiteMeanMin?: number;
  /** Min fraction of span that must be divider-white at band peak (default 0.28). */
  minSpanRatio?: number;
  /** Search radius as a fraction of cell size (default 0.16). */
  searchRadiusRatio?: number;
  /** Max divider band thickness in px (default 24). */
  maxBandThickness?: number;
  /** Max channel value for a near-black divider pixel (default 90). */
  darkMaxChannel?: number;
  /** Max mean RGB for dark divider pixels (default 75). */
  darkMeanMax?: number;
}

export function isDividerDarkPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  options: Pick<DetectWhiteDividerOptions, 'darkMaxChannel' | 'darkMeanMax'> = {}
): boolean {
  if (a <= 20) return false;
  const darkMaxChannel = options.darkMaxChannel ?? 90;
  const darkMeanMax = options.darkMeanMax ?? 75;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const mean = (r + g + b) / 3;
  // ponytail: opaque near-black grid seams must not be classified as letterbox padding.
  return max < darkMaxChannel && mean < darkMeanMax && max - min < 40;
}

export function isGridDividerPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  options: DetectWhiteDividerOptions = {}
): boolean {
  return isDividerWhitePixel(r, g, b, a, options) || isDividerDarkPixel(r, g, b, a, options);
}

export function isDividerWhitePixel(
  r: number,
  g: number,
  b: number,
  a: number,
  options: Pick<DetectWhiteDividerOptions, 'whiteMinChannel' | 'whiteMeanMin'> = {}
): boolean {
  if (a <= 20) return false;
  if (isSliceBackgroundPixel(r, g, b, a)) return false;
  const whiteMinChannel = options.whiteMinChannel ?? 170;
  const whiteMeanMin = options.whiteMeanMin ?? 200;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const mean = (r + g + b) / 3;
  // Grid dividers are neutral light gray/white (not saturated character colors).
  return min >= whiteMinChannel && mean >= whiteMeanMin && max - min <= 55;
}

function scoreVerticalDividerColumn(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  options: DetectWhiteDividerOptions
): number {
  if (x < 0 || x >= width) return 0;
  let match = 0;
  for (let y = 0; y < height; y++) {
    const offset = (y * width + x) * 4;
    if (
      isGridDividerPixel(
        data[offset]!,
        data[offset + 1]!,
        data[offset + 2]!,
        data[offset + 3]!,
        options
      )
    ) {
      match++;
    }
  }
  return match / height;
}

function scoreHorizontalDividerRow(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  y: number,
  x0: number,
  x1: number,
  options: DetectWhiteDividerOptions
): number {
  if (y < 0 || y >= height) return 0;
  const span = Math.max(1, x1 - x0);
  let match = 0;
  for (let x = x0; x < x1; x++) {
    const offset = (y * width + x) * 4;
    if (
      isGridDividerPixel(
        data[offset]!,
        data[offset + 1]!,
        data[offset + 2]!,
        data[offset + 3]!,
        options
      )
    ) {
      match++;
    }
  }
  return match / span;
}

function smoothScoresMax(scores: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(scores.length);
  for (let i = 0; i < scores.length; i++) {
    let peak = 0;
    for (let d = -radius; d <= radius; d++) {
      const value = scores[i + d];
      if (value !== undefined) {
        peak = Math.max(peak, value);
      }
    }
    out[i] = peak;
  }
  return out;
}

function findDividerBand(
  scores: Float32Array,
  offset: number,
  theoretical: number,
  searchRadius: number,
  minSpanRatio: number,
  maxBandThickness: number,
  minPos: number,
  maxPos: number
): WhiteDividerBand | null {
  const startSearch = Math.max(minPos + 1, theoretical - searchRadius);
  const endSearch = Math.min(maxPos - 1, theoretical + searchRadius);

  let peakPos = theoretical;
  let peakScore = 0;
  for (let pos = startSearch; pos <= endSearch; pos++) {
    const value = scores[pos - offset] ?? 0;
    const centerDist = Math.abs(pos - theoretical);
    const adjusted = value - centerDist / Math.max(1, searchRadius * 6);
    if (adjusted > peakScore) {
      peakScore = adjusted;
      peakPos = pos;
    }
  }

  if (peakScore < minSpanRatio) {
    return null;
  }

  const bandThreshold = Math.max(minSpanRatio * 0.45, peakScore * 0.42);

  let bandStart = peakPos;
  while (bandStart > startSearch && (scores[bandStart - 1 - offset] ?? 0) >= bandThreshold) {
    bandStart--;
  }

  let bandEnd = peakPos;
  while (bandEnd < endSearch && (scores[bandEnd + 1 - offset] ?? 0) >= bandThreshold) {
    bandEnd++;
  }

  const thickness = bandEnd - bandStart + 1;
  if (thickness > maxBandThickness) {
    return null;
  }

  return {
    start: bandStart,
    end: bandEnd,
    center: Math.round((bandStart + bandEnd) / 2),
  };
}

function columnXRange(
  col: number,
  cols: number,
  width: number,
  verticalBands: Array<WhiteDividerBand | null>
): { x0: number; x1: number } {
  const fallbackX0 = Math.round((col * width) / cols);
  const fallbackX1 = Math.round(((col + 1) * width) / cols);
  const x0 = col === 0 ? 0 : (verticalBands[col - 1]?.end ?? fallbackX0 - 1) + 1;
  const x1 = col === cols - 1 ? width : (verticalBands[col]?.start ?? fallbackX1);
  return { x0, x1 };
}

function rowYRange(
  row: number,
  rows: number,
  height: number,
  horizontalBands: Array<WhiteDividerBand | null>
): { y0: number; y1: number } {
  const fallbackY0 = Math.round((row * height) / rows);
  const fallbackY1 = Math.round(((row + 1) * height) / rows);
  const y0 = row === 0 ? 0 : (horizontalBands[row - 1]?.end ?? fallbackY0 - 1) + 1;
  const y1 = row === rows - 1 ? height : (horizontalBands[row]?.start ?? fallbackY1);
  return { y0, y1 };
}

/**
 * Locate white divider bands near theoretical grid seams.
 * Returns null bands where no confident divider was found (equal-split fallback per edge).
 */
export function detectWhiteDividerGrid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number,
  options: DetectWhiteDividerOptions = {}
): WhiteDividerGrid {
  const searchRadiusRatio = options.searchRadiusRatio ?? 0.16;
  const minSpanRatio = options.minSpanRatio ?? 0.28;
  const maxBandThickness = options.maxBandThickness ?? 20;
  const cellW = width / cols;
  const cellH = height / rows;
  const radiusX = Math.max(16, Math.floor(cellW * searchRadiusRatio));
  const radiusY = Math.max(14, Math.floor(cellH * searchRadiusRatio));

  const verticalScoresRaw = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    verticalScoresRaw[x] = scoreVerticalDividerColumn(data, width, height, x, options);
  }
  const verticalScores = smoothScoresMax(verticalScoresRaw, 2);

  const verticalBands: Array<WhiteDividerBand | null> = [];
  for (let c = 1; c < cols; c++) {
    const theoretical = Math.round((c * width) / cols);
    verticalBands.push(
      findDividerBand(
        verticalScores,
        0,
        theoretical,
        radiusX,
        minSpanRatio,
        maxBandThickness,
        0,
        width
      )
    );
  }

  const horizontalBandsPerColumn: Array<Array<WhiteDividerBand | null>> = [];
  const globalRowScoresRaw = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    globalRowScoresRaw[y] = scoreHorizontalDividerRow(data, width, height, y, 0, width, options);
  }
  const globalRowScores = smoothScoresMax(globalRowScoresRaw, 2);
  const globalRowBands: Array<WhiteDividerBand | null> = [];
  for (let r = 1; r < rows; r++) {
    const theoretical = Math.round((r * height) / rows);
    globalRowBands.push(
      findDividerBand(
        globalRowScores,
        0,
        theoretical,
        radiusY,
        minSpanRatio,
        maxBandThickness,
        0,
        height
      )
    );
  }

  for (let c = 0; c < cols; c++) {
    const { x0, x1 } = columnXRange(c, cols, width, verticalBands);
    const rowScoresRaw = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      rowScoresRaw[y] = scoreHorizontalDividerRow(data, width, height, y, x0, x1, options);
    }
    const rowScores = smoothScoresMax(rowScoresRaw, 2);

    const bands: Array<WhiteDividerBand | null> = [];
    for (let r = 1; r < rows; r++) {
      const theoretical = Math.round((r * height) / rows);
      const local =
        findDividerBand(
          rowScores,
          0,
          theoretical,
          radiusY,
          minSpanRatio,
          maxBandThickness,
          0,
          height
        ) ?? globalRowBands[r - 1] ?? null;
      bands.push(local);
    }
    horizontalBandsPerColumn.push(bands);
  }

  return { verticalBands, horizontalBandsPerColumn };
}

export function countDetectedWhiteDividers(grid: WhiteDividerGrid): number {
  let count = grid.verticalBands.filter(Boolean).length;
  for (const colBands of grid.horizontalBandsPerColumn) {
    count += colBands.filter(Boolean).length;
  }
  return count;
}

/** Minimum detected dividers to trust divider-based slicing (roughly half of internal seams). */
export function shouldUseWhiteDividerSlice(
  grid: WhiteDividerGrid,
  cols: number,
  rows: number
): boolean {
  const expected = Math.max(1, cols - 1 + rows - 1);
  const found = countDetectedWhiteDividers(grid);
  return found >= Math.ceil(expected * 0.35);
}

export interface DividerCellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Cell crop rectangle that excludes detected white divider bands. */
export function computeDividerCellRect(
  width: number,
  height: number,
  cols: number,
  rows: number,
  row: number,
  col: number,
  grid: WhiteDividerGrid
): DividerCellRect {
  const { x0, x1 } = columnXRange(col, cols, width, grid.verticalBands);
  const colBands = grid.horizontalBandsPerColumn[col] ?? [];
  const { y0, y1 } = rowYRange(row, rows, height, colBands);
  return {
    x0: Math.max(0, x0),
    y0: Math.max(0, y0),
    x1: Math.min(width, Math.max(x0 + 1, x1)),
    y1: Math.min(height, Math.max(y0 + 1, y1)),
  };
}

/** Near-white or near-black neutral pixels left from grid seams or JPEG fringe. */
export function isNearNeutralEdgeArtifactPixel(
  r: number,
  g: number,
  b: number,
  a: number
): boolean {
  if (a <= 20) return false;
  if (isSliceBackgroundPixel(r, g, b, a)) return false;
  if (isNearWhiteArtifactPixel(r, g, b, a)) return true;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const mean = (r + g + b) / 3;
  return max < 95 && mean < 85 && max - min < 45;
}

export function isNearWhiteArtifactPixel(
  r: number,
  g: number,
  b: number,
  a: number
): boolean {
  if (a <= 20) return false;
  if (isSliceBackgroundPixel(r, g, b, a)) return false;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const mean = (r + g + b) / 3;
  return min >= 150 && mean >= 185 && max - min <= 60;
}

/**
 * Erase edge-connected near-white seam residue inside a sticker frame.
 * Targets grid divider leftovers without removing saturated character colors.
 */
export function clearNearWhiteEdgeArtifacts(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  maxDepthPx: number
): number {
  const maxDepth = Math.max(1, Math.floor(maxDepthPx));
  const total = width * height;
  const visited = new Uint8Array(total);
  let frontier: number[] = [];
  let cleared = 0;

  const isArtifact = (p: number) => {
    const o = p * 4;
    return isNearNeutralEdgeArtifactPixel(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!);
  };
  const erase = (p: number) => {
    data[p * 4 + 3] = 0;
    cleared++;
  };

  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isArtifact(p)) {
      erase(p);
      frontier.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  for (let depth = 1; depth < maxDepth && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      const y = (p - x) / width;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ];
      for (const np of neighbors) {
        if (np < 0 || visited[np]) continue;
        visited[np] = 1;
        if (isArtifact(np)) {
          erase(np);
          next.push(np);
        }
      }
    }
    frontier = next;
  }

  return cleared;
}

export interface ClearSheetGridDividersResult {
  cleared: number;
  applied: boolean;
  verticalBands: number;
}

/**
 * Erase detected vertical grid divider bands on a processed sprite sheet.
 * Runs after chroma key when divider seams survived as opaque black/gray lines.
 */
export function clearDetectedSheetGridDividers(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  cols: number,
  rows: number,
  options: DetectWhiteDividerOptions = {}
): ClearSheetGridDividersResult {
  // ponytail: accept broader input, but the detector expects Uint8ClampedArray.
  // Use a clamped view/copy for detection only; we still mutate the original `data` below.
  const dataForDetect =
    data instanceof Uint8ClampedArray
      ? data
      : data instanceof Uint8Array
        ? new Uint8ClampedArray(data)
        : new Uint8ClampedArray(data);
  const grid = detectWhiteDividerGrid(dataForDetect, width, height, cols, rows, options);
  const verticalBands = grid.verticalBands.filter(Boolean);
  const minVertical = Math.max(1, Math.ceil((cols - 1) * 0.5));
  if (verticalBands.length < minVertical) {
    return { cleared: 0, applied: false, verticalBands: verticalBands.length };
  }

  let cleared = 0;
  const clearPixel = (offset: number): void => {
    if (
      data[offset]! !== 0 ||
      data[offset + 1]! !== 0 ||
      data[offset + 2]! !== 0 ||
      data[offset + 3]! !== 0
    ) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      cleared++;
    }
  };

  for (const band of verticalBands) {
    if (!band) continue;
    for (let x = band.start; x <= band.end; x++) {
      for (let y = 0; y < height; y++) {
        const offset = (y * width + x) * 4;
        clearPixel(offset);
      }
    }
  }

  for (let row = 0; row < rows - 1; row++) {
    const bands = grid.horizontalBandsPerColumn
      .map((colBands) => colBands[row])
      .filter((band): band is WhiteDividerBand => band !== null);
    if (bands.length === 0) continue;
    const y0 = Math.min(...bands.map((band) => band.start));
    const y1 = Math.max(...bands.map((band) => band.end));
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        clearPixel(offset);
      }
    }
  }

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3]! <= 20) {
      clearPixel(offset);
    }
  }

  return { cleared, applied: true, verticalBands: verticalBands.length };
}
