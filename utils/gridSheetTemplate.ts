/**
 * Pixel-perfect LINE sticker sheet canvas templates for Gemini inpainting.
 * `solid` = pure chroma fill (plan A). `guided` = visible grid layout ref (plan B).
 */

import type { ChromaKeyColorType } from '../types';
import { CHROMA_KEY_COLORS } from './constants';
import { LINE_STICKER_SPRITE_SHEET_SIZE_PX } from './lineStickerSheetAspect';

export type GridTemplateMode = 'solid' | 'guided';

export interface GridSheetTemplate {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  xBounds: number[];
  yBounds: number[];
  cols: number;
  rows: number;
  mode: GridTemplateMode;
}

export interface EqualGridBounds {
  xBounds: number[];
  yBounds: number[];
}

/** Equal-split grid seam positions for a square canvas. */
export function buildEqualGridBounds(sizePx: number, cols: number, rows: number): EqualGridBounds {
  return {
    xBounds: Array.from({ length: cols + 1 }, (_, i) => Math.round((i * sizePx) / cols)),
    yBounds: Array.from({ length: rows + 1 }, (_, i) => Math.round((i * sizePx) / rows)),
  };
}

export interface BuildGridSheetTemplateOptions {
  sizePx?: number;
  chromaKeyColor?: ChromaKeyColorType;
  /** `solid` = blank chroma (plan A). `guided` = visible grid layout canvas (plan B). */
  mode?: GridTemplateMode;
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255
): void {
  if (x < 0 || y < 0 || x >= width) return;
  const offset = (y * width + x) * 4;
  data[offset] = r;
  data[offset + 1] = g;
  data[offset + 2] = b;
  data[offset + 3] = a;
}

function fillChromaBackground(
  data: Uint8ClampedArray,
  chromaKeyColor: ChromaKeyColorType
): void {
  const { r, g, b } = CHROMA_KEY_COLORS[chromaKeyColor];
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
}

/** Darker chroma-family groove — visible to the model, removed by chroma key/normalize. */
function grooveColor(chromaKeyColor: ChromaKeyColorType): { r: number; g: number; b: number } {
  if (chromaKeyColor === 'green') {
    return { r: 0, g: 152, b: 0 };
  }
  return { r: 210, g: 0, b: 210 };
}

function drawHorizontalGroove(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  y: number,
  x0: number,
  x1: number,
  color: { r: number; g: number; b: number },
  thickness: number
): void {
  for (let dy = 0; dy < thickness; dy++) {
    const yy = y + dy - Math.floor(thickness / 2);
    if (yy < 0 || yy >= height) continue;
    for (let x = x0; x < x1; x++) {
      setPixel(data, width, x, yy, color.r, color.g, color.b);
    }
  }
}

function drawVerticalGroove(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y0: number,
  y1: number,
  color: { r: number; g: number; b: number },
  thickness: number
): void {
  for (let dx = 0; dx < thickness; dx++) {
    const xx = x + dx - Math.floor(thickness / 2);
    if (xx < 0 || xx >= width) continue;
    for (let y = y0; y < y1; y++) {
      setPixel(data, width, xx, y, color.r, color.g, color.b);
    }
  }
}

function drawCellCornerTicks(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: { r: number; g: number; b: number },
  tickLen: number,
  insetPx: number
): void {
  const left = x0 + insetPx;
  const top = y0 + insetPx;
  const right = x1 - insetPx;
  const bottom = y1 - insetPx;
  if (right <= left + tickLen || bottom <= top + tickLen) return;

  drawHorizontalGroove(data, width, height, top, left, left + tickLen, color, 1);
  drawVerticalGroove(data, width, height, left, top, top + tickLen, color, 1);

  drawHorizontalGroove(data, width, height, top, right - tickLen, right, color, 1);
  drawVerticalGroove(data, width, height, right, top, top + tickLen, color, 1);

  drawHorizontalGroove(data, width, height, bottom, left, left + tickLen, color, 1);
  drawVerticalGroove(data, width, height, left, bottom - tickLen, bottom, color, 1);

  drawHorizontalGroove(data, width, height, bottom, right - tickLen, right, color, 1);
  drawVerticalGroove(data, width, height, right, bottom - tickLen, bottom, color, 1);
}

function drawGuidedGridOverlay(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number,
  xBounds: number[],
  yBounds: number[],
  chromaKeyColor: ChromaKeyColorType
): void {
  const groove = grooveColor(chromaKeyColor);
  const grooveThickness = 1;

  // Single-pixel seam guides only — no per-cell inner frames (they caused column drift).
  for (let c = 1; c < cols; c++) {
    drawVerticalGroove(data, width, height, xBounds[c]!, 0, height, groove, grooveThickness);
  }
  for (let r = 1; r < rows; r++) {
    drawHorizontalGroove(data, width, height, yBounds[r]!, 0, width, groove, grooveThickness);
  }

  const cellW = width / cols;
  const cellH = height / rows;
  const tickLen = Math.max(8, Math.round(Math.min(cellW, cellH) * 0.06));
  const insetPx = Math.max(10, Math.round(Math.min(cellW, cellH) * 0.1));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      drawCellCornerTicks(
        data,
        width,
        height,
        xBounds[col]!,
        yBounds[row]!,
        xBounds[col + 1]!,
        yBounds[row + 1]!,
        groove,
        tickLen,
        insetPx
      );
    }
  }
}

/**
 * Build a chroma-key sheet template.
 * - `solid`: blank chroma canvas (plan A).
 * - `guided`: visible grid layout reference for the model to paint on (plan B).
 */
export function buildGridSheetTemplate(
  cols: number,
  rows: number,
  options: BuildGridSheetTemplateOptions = {}
): GridSheetTemplate {
  const sizePx = options.sizePx ?? LINE_STICKER_SPRITE_SHEET_SIZE_PX;
  const chromaKeyColor = options.chromaKeyColor ?? 'green';
  const mode = options.mode ?? 'solid';

  const data = new Uint8ClampedArray(sizePx * sizePx * 4);
  fillChromaBackground(data, chromaKeyColor);

  const { xBounds, yBounds } = buildEqualGridBounds(sizePx, cols, rows);
  if (mode === 'guided') {
    drawGuidedGridOverlay(data, sizePx, sizePx, cols, rows, xBounds, yBounds, chromaKeyColor);
  }

  return { data, width: sizePx, height: sizePx, xBounds, yBounds, cols, rows, mode };
}
