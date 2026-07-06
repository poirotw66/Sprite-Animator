/**
 * Post-generation grid alignment checks for LINE sticker sprite sheets.
 * Pure RGBA analysis (no DOM) — usable from browser workers and Node skill scripts.
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';
import { detectSheetGridBoundaries } from './sheetBoundaryDetection';

export interface GridLayoutScore {
  cols: number;
  rows: number;
  score: number;
}

export interface GridValidationOptions {
  /** Minimum boundary-alignment score for the expected grid (0–1). Default 0.72. */
  minScore?: number;
  /** When another grid ties within this margin, prefer the expected cols×rows. Default 0.03. */
  scoreTieMargin?: number;
  /** Reject when best-fit layout differs from expected cols×rows (default: true). */
  requireExactLayout?: boolean;
  /** Max column-width coefficient of variation (default: 0.12). Lower = more uniform. */
  maxColumnWidthCv?: number;
  /** Score band where boundary reslice may recover without a new Gemini call. */
  resliceScoreMin?: number;
  colCandidates?: number[];
  rowCandidates?: number[];
}

export interface GridValidationResult {
  ok: boolean;
  expected: GridLayoutScore;
  detected: GridLayoutScore;
  columnWidthCv?: number;
  /** True when a boundary reslice might fix a marginal failure without regen. */
  resliceCandidate?: boolean;
  reason?: string;
}

function uniqueGridCandidates(...values: number[]): number[] {
  return [...new Set(values.filter((n) => n >= 2 && n <= 6))].sort((a, b) => a - b);
}

/** Nearby column/row counts to scan when detecting model layout drift. */
export function buildGridCandidates(expectedCols: number, expectedRows: number): {
  colCandidates: number[];
  rowCandidates: number[];
} {
  return {
    colCandidates: uniqueGridCandidates(expectedCols - 1, expectedCols, expectedCols + 1),
    rowCandidates: uniqueGridCandidates(expectedRows - 1, expectedRows, expectedRows + 1),
  };
}

/** Score how well internal grid boundaries align with empty/chroma background seams. */
export function scoreGridLayoutFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number
): number {
  if (width <= 0 || height <= 0 || cols < 1 || rows < 1) return 0;
  if (cols < 2 && rows < 2) return 0;

  const isBg = (offset: number) =>
    isSliceBackgroundPixel(
      data[offset]!,
      data[offset + 1]!,
      data[offset + 2]!,
      data[offset + 3]!
    );

  let total = 0;
  let count = 0;
  const cellW = width / cols;
  const cellH = height / rows;

  for (let c = 1; c < cols; c++) {
    const x = Math.round(c * cellW);
    let empty = 0;
    for (let y = 0; y < height; y++) {
      if (isBg((y * width + x) * 4)) empty++;
    }
    total += empty / height;
    count++;
  }
  for (let r = 1; r < rows; r++) {
    const y = Math.round(r * cellH);
    let empty = 0;
    for (let x = 0; x < width; x++) {
      if (isBg((y * width + x) * 4)) empty++;
    }
    total += empty / width;
    count++;
  }
  return count > 0 ? total / count : 0;
}

export function detectBestGridLayoutFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colCandidates: number[],
  rowCandidates: number[]
): GridLayoutScore {
  let best: GridLayoutScore = {
    cols: colCandidates[0] ?? 4,
    rows: rowCandidates[0] ?? 5,
    score: -1,
  };
  for (const cols of colCandidates) {
    for (const rows of rowCandidates) {
      const score = scoreGridLayoutFromRgba(data, width, height, cols, rows);
      if (score > best.score) {
        best = { cols, rows, score };
      }
    }
  }
  return best;
}

/** Coefficient of variation for column widths from vertical boundary positions. */
export function columnWidthCoefficientOfVariation(xBounds: number[]): number {
  if (xBounds.length < 3) return 0;
  const widths: number[] = [];
  for (let i = 0; i < xBounds.length - 1; i++) {
    widths.push(xBounds[i + 1]! - xBounds[i]!);
  }
  const mean = widths.reduce((sum, w) => sum + w, 0) / widths.length;
  if (mean <= 0) return 1;
  const variance = widths.reduce((sum, w) => sum + (w - mean) ** 2, 0) / widths.length;
  return Math.sqrt(variance) / mean;
}

export function measureColumnUniformityFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number
): number {
  const { xBounds } = detectSheetGridBoundaries(data, width, height, cols, rows);
  return columnWidthCoefficientOfVariation(xBounds);
}

/** Composite ranking for picking the best generation attempt (higher = better). */
export function rankSheetAttempt(result: GridValidationResult, expectedCols: number, expectedRows: number): number {
  let rank = result.expected.score;
  if (result.detected.cols !== expectedCols || result.detected.rows !== expectedRows) {
    rank -= 0.45;
  }
  if (result.columnWidthCv != null) {
    rank -= result.columnWidthCv * 0.35;
  }
  return rank;
}

/** Returns whether the processed sheet matches the intended cols×rows grid. */
export function validateSheetGrid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number,
  options: GridValidationOptions = {}
): GridValidationResult {
  const minScore = options.minScore ?? 0.72;
  const scoreTieMargin = options.scoreTieMargin ?? 0.03;
  const requireExactLayout = options.requireExactLayout !== false;
  const maxColumnWidthCv = options.maxColumnWidthCv ?? 0.12;
  const resliceScoreMin = options.resliceScoreMin ?? 0.68;
  const { colCandidates, rowCandidates } = options.colCandidates && options.rowCandidates
    ? { colCandidates: options.colCandidates, rowCandidates: options.rowCandidates }
    : buildGridCandidates(cols, rows);

  const expected: GridLayoutScore = {
    cols,
    rows,
    score: scoreGridLayoutFromRgba(data, width, height, cols, rows),
  };
  const detected = detectBestGridLayoutFromRgba(data, width, height, colCandidates, rowCandidates);
  const columnWidthCv = measureColumnUniformityFromRgba(data, width, height, cols, rows);
  const layoutMatches = detected.cols === cols && detected.rows === rows;

  if (requireExactLayout && !layoutMatches) {
    const resliceCandidate =
      expected.score >= resliceScoreMin &&
      expected.score >= detected.score - scoreTieMargin;
    return {
      ok: false,
      expected,
      detected,
      columnWidthCv,
      resliceCandidate,
      reason: `layout looks like ${detected.cols}×${detected.rows} (score ${detected.score.toFixed(2)}) instead of ${cols}×${rows} (score ${expected.score.toFixed(2)})`,
    };
  }

  if (columnWidthCv > maxColumnWidthCv) {
    const resliceCandidate = layoutMatches && expected.score >= resliceScoreMin;
    return {
      ok: false,
      expected,
      detected,
      columnWidthCv,
      resliceCandidate,
      reason: `column widths uneven (CV ${columnWidthCv.toFixed(3)} > ${maxColumnWidthCv.toFixed(3)})`,
    };
  }

  const closeEnough =
    expected.score >= minScore && expected.score >= detected.score - scoreTieMargin;

  if (!closeEnough) {
    const resliceCandidate =
      layoutMatches &&
      expected.score >= resliceScoreMin &&
      expected.score < minScore;
    return {
      ok: false,
      expected,
      detected,
      columnWidthCv,
      resliceCandidate,
      reason: `${cols}×${rows} alignment score ${expected.score.toFixed(2)} is below minimum ${minScore.toFixed(2)}`,
    };
  }

  return { ok: true, expected, detected, columnWidthCv };
}

/** Extra prompt block appended when a generation attempt failed grid validation. */
export function buildGridRetryPromptSuffix(
  cols: number,
  rows: number,
  previous?: Pick<GridValidationResult, 'detected'>
): string {
  const totalFrames = cols * rows;
  const cellWidthPct = (100 / cols).toFixed(1);
  const cellHeightPct = (100 / rows).toFixed(1);
  const wrongLayout = previous?.detected
    ? ` Your previous output aligned best as ${previous.detected.cols}×${previous.detected.rows}, which is WRONG.`
    : '';

  return `

---

### [GRID CORRECTION — MANDATORY, OVERRIDES ALL OTHER LAYOUT HINTS]
${wrongLayout}
Your last output had the WRONG geometry. Fix it completely.

**REQUIRED:** EXACTLY **${cols} columns × ${rows} rows** = **${totalFrames} cells**.
- NOT ${cols + 1} columns. NOT ${rows + 1} rows. NOT ${cols + 1}×${cols + 1} (${(cols + 1) * (cols + 1)} cells).
- Each column = **${cellWidthPct}%** of width (${cols} equal columns, edge to edge).
- Each row = **${cellHeightPct}%** of height (${rows} equal rows, edge to edge).
- Every horizontal row has exactly **${cols}** stickers — count them row by row.
- No letterboxing, black bars, or extra blank columns/rows outside the grid.
- Fill the full canvas: ${cols} across × ${rows} down = ${totalFrames} stickers only.

Before finishing, verify: row 1 has ${cols} cells, row ${rows} has ${cols} cells, total = ${totalFrames}.`;
}
