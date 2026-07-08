/**
 * Caption auto-placement for LINE sticker overlay.
 *
 * One pass builds a downsampled foreground occupancy grid plus a summed-area
 * table, then a dense grid search finds the caption box center with the least
 * foreground overlap (O(1) overlap query per candidate). Font size shrinks in
 * steps only when no overlap-free spot exists at the current size.
 *
 * Replaces the previous stack of per-label band searches, anchor nudging, and
 * refinement loops with a single scoring pass shared by the browser and node
 * render pipelines.
 */

import {
  wrapLines,
  textOverlayAvoidancePadPx,
} from './lineStickerTextOverlayGeometry';

function isChromaLikePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 12) return true;
  const magentaScore = Math.abs(r - 255) + Math.abs(g) + Math.abs(b - 255);
  const greenScore = Math.abs(r) + Math.abs(g - 255) + Math.abs(b);
  return magentaScore < 72 || greenScore < 72;
}

function isForegroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 18) return false;
  return !isChromaLikePixel(r, g, b, a);
}

export function frameInsetPx(width: number, height: number, marginRatio: number): number {
  return Math.max(2, Math.round(Math.min(width, height) * marginRatio));
}

/** Downsampled foreground occupancy with a summed-area table for O(1) box queries. */
export interface ForegroundOverlapIndex {
  cols: number;
  rows: number;
  step: number;
  /** (cols+1)*(rows+1) inclusive-prefix sums of the dilated occupancy grid. */
  sat: Int32Array;
}

export function buildForegroundOverlapIndex(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): ForegroundOverlapIndex {
  const step = Math.max(2, Math.round(Math.min(width, height) / 96));
  const cols = Math.max(1, Math.ceil(width / step));
  const rows = Math.max(1, Math.ceil(height / step));
  const occupied = new Uint8Array(cols * rows);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const sample = Math.min(2, step);
  for (let y = 0; y < height; y += sample) {
    const gridRow = Math.min(rows - 1, Math.floor(y / step)) * cols;
    for (let x = 0; x < width; x += sample) {
      const i = (y * width + x) * 4;
      if (isForegroundPixel(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, pixels[i + 3]!)) {
        occupied[gridRow + Math.min(cols - 1, Math.floor(x / step))] = 1;
      }
    }
  }

  // 1-cell dilation approximates the caption stroke halo without a distance transform.
  const dilated = new Uint8Array(occupied);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occupied[r * cols + c]) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) dilated[nr * cols + nc] = 1;
        }
      }
    }
  }

  const satW = cols + 1;
  const sat = new Int32Array(satW * (rows + 1));
  for (let r = 0; r < rows; r++) {
    let rowSum = 0;
    for (let c = 0; c < cols; c++) {
      rowSum += dilated[r * cols + c]!;
      sat[(r + 1) * satW + (c + 1)] = sat[r * satW + (c + 1)]! + rowSum;
    }
  }

  return { cols, rows, step, sat };
}

/** Occupied grid cells intersecting the pixel-space box (SAT query). */
export function countOverlapCellsInBox(
  index: ForegroundOverlapIndex,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number {
  const { cols, rows, step, sat } = index;
  const c0 = Math.max(0, Math.floor(minX / step));
  const r0 = Math.max(0, Math.floor(minY / step));
  const c1 = Math.min(cols - 1, Math.ceil(maxX / step) - 1);
  const r1 = Math.min(rows - 1, Math.ceil(maxY / step) - 1);
  if (c1 < c0 || r1 < r0) return 0;
  const satW = cols + 1;
  return (
    sat[(r1 + 1) * satW + (c1 + 1)]! -
    sat[r0 * satW + (c1 + 1)]! -
    sat[(r1 + 1) * satW + c0]! +
    sat[r0 * satW + c0]!
  );
}

/** Preferred caption box center for a prompt placement label (variety across frames). */
export function preferredCaptionCenterForLabel(
  label: string,
  width: number,
  height: number,
  boxW: number,
  boxH: number,
  marginRatio: number
): { x: number; y: number } {
  const margin = frameInsetPx(width, height, marginRatio);
  const topY = margin + boxH / 2;
  const bottomY = height - margin - boxH / 2;
  const leftX = margin + boxW / 2;
  const rightX = width - margin - boxW / 2;
  const centerX = width / 2;
  const lower = label.toLowerCase();

  if (lower.includes('top left')) return { x: leftX, y: topY };
  if (lower.includes('top right')) return { x: rightX, y: topY };
  if (lower.includes('top center')) return { x: centerX, y: topY };
  if (lower.includes('bottom left')) return { x: leftX, y: bottomY };
  if (lower.includes('bottom right')) return { x: rightX, y: bottomY };
  if (lower.includes('bottom')) return { x: centerX, y: bottomY };
  if (lower.includes('beside head (left)')) return { x: leftX, y: height * 0.42 };
  if (lower.includes('beside head (right)')) return { x: rightX, y: height * 0.42 };
  if (lower.includes('diagonal')) return { x: width * 0.62, y: height * 0.74 };
  if (lower.includes('middle center')) return { x: centerX, y: height / 2 };
  return { x: centerX, y: bottomY };
}

export interface CaptionCenterSearch {
  width: number;
  height: number;
  insetPx: number;
  preferredX: number;
  preferredY: number;
}

export interface CaptionCenterResult {
  centerX: number;
  centerY: number;
  overlapCells: number;
}

/**
 * Dense grid search over the whole frame for the caption box center with the
 * least foreground overlap; ties resolve toward the preferred center.
 */
export function findLeastOverlapCaptionCenter(
  index: ForegroundOverlapIndex,
  boxW: number,
  boxH: number,
  search: CaptionCenterSearch
): CaptionCenterResult {
  const { width, height, insetPx, preferredX, preferredY } = search;
  const halfW = boxW / 2;
  const halfH = boxH / 2;
  let minCx = insetPx + halfW;
  let maxCx = width - insetPx - halfW;
  let minCy = insetPx + halfH;
  let maxCy = height - insetPx - halfH;
  if (maxCx < minCx) minCx = maxCx = width / 2;
  if (maxCy < minCy) minCy = maxCy = height / 2;

  const step = index.step;
  const diag = Math.hypot(width, height);
  let best: CaptionCenterResult = { centerX: preferredX, centerY: preferredY, overlapCells: Infinity };
  let bestScore = Infinity;

  for (let cy = minCy; cy <= maxCy + 0.001; cy += step) {
    for (let cx = minCx; cx <= maxCx + 0.001; cx += step) {
      const overlap = countOverlapCellsInBox(index, cx - halfW, cy - halfH, cx + halfW, cy + halfH);
      const dist = Math.hypot(cx - preferredX, cy - preferredY) / diag;
      const score = overlap * 1000 + dist;
      if (score < bestScore) {
        bestScore = score;
        best = { centerX: cx, centerY: cy, overlapCells: overlap };
      }
    }
  }
  return best;
}

export interface AutoCaptionLayoutParams {
  width: number;
  height: number;
  text: string;
  /** Placement label whose zone is preferred when several spots are overlap-free. */
  preferredLabel: string;
  marginRatio: number;
  lineHeightMultiplier: number;
  strokeScale: number;
  /** Font size in px at scale 1. Shrinks stepwise if no overlap-free spot fits. */
  baseFontSizePx: number;
  /** Applies a font size to ctx.font (caller owns family/weight resolution). */
  applyFont: (fontSizePx: number) => void;
}

export interface AutoCaptionLayout {
  centerX: number;
  centerY: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  overlapCells: number;
}

const CAPTION_FONT_SCALE_STEPS = [1, 0.85, 0.72] as const;

/**
 * Full auto layout: wrap text, search the least-overlap center, shrink font
 * only while overlap remains. Draw the result with textAlign='center' and
 * textBaseline='middle'; line i sits at centerY + (i - (n-1)/2) * lineHeight.
 */
export function computeAutoCaptionLayout(
  ctx: CanvasRenderingContext2D,
  params: AutoCaptionLayoutParams
): AutoCaptionLayout {
  const { width, height, text, preferredLabel, marginRatio } = params;
  const index = buildForegroundOverlapIndex(ctx, width, height);
  const insetPx = frameInsetPx(width, height, marginRatio);
  const maxLineWidth = Math.min(width * 0.92, width - insetPx * 2);

  let best: AutoCaptionLayout | null = null;
  for (const scale of CAPTION_FONT_SCALE_STEPS) {
    const fontSize = Math.max(9, Math.round(params.baseFontSizePx * scale));
    params.applyFont(fontSize);
    const lineHeight = fontSize * params.lineHeightMultiplier;
    const lines = wrapLines(ctx, text, maxLineWidth);
    const { padX, padY } = textOverlayAvoidancePadPx(fontSize, params.strokeScale);
    const maxLineW = Math.max(...lines.map((line) => ctx.measureText(line || ' ').width), 1);
    const boxW = maxLineW + padX * 2;
    const boxH = lines.length * lineHeight + padY * 2;
    const preferred = preferredCaptionCenterForLabel(
      preferredLabel,
      width,
      height,
      boxW,
      boxH,
      marginRatio
    );
    const center = findLeastOverlapCaptionCenter(index, boxW, boxH, {
      width,
      height,
      insetPx,
      preferredX: preferred.x,
      preferredY: preferred.y,
    });
    const candidate: AutoCaptionLayout = {
      centerX: center.centerX,
      centerY: center.centerY,
      lines,
      fontSize,
      lineHeight,
      overlapCells: center.overlapCells,
    };
    if (best === null || candidate.overlapCells < best.overlapCells) {
      best = candidate;
    }
    if (best.overlapCells === 0) break;
  }
  // best is always assigned: the scale loop runs at least once.
  const layout = best!;
  params.applyFont(layout.fontSize);
  return layout;
}
