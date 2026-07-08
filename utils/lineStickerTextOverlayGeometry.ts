/**
 * Pure geometry & text-layout helpers for LINE sticker programmatic overlay.
 * No DOM/canvas creation here (functions may take a CanvasRenderingContext2D for
 * text measurement only). Extracted from lineStickerTextOverlay.ts so the subject
 * detection and rendering layers can share these without circular coupling.
 */

import { RESERVED_CAPTION_BAND_HEIGHT_RATIO } from './lineStickerPrompt';

export interface TextPlacementLayout {
  anchorX: number;
  anchorY: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  maxWidth: number;
}

export interface LayoutFromPlacementOptions {
  /** When true, anchors sit in the same caption-band zones described in the generation prompt. */
  useReservedCaptionBandAnchors?: boolean;
}

/**
 * Unit direction to nudge text within a caption band when it still overlaps the subject (keeps text in-band).
 */
export function preferredNudgeDirectionForPlacementLabel(
  label: string
): { dirX: number; dirY: number } | undefined {
  const lower = label.toLowerCase();
  if (lower.includes('bottom')) {
    return { dirX: 0, dirY: -1 };
  }
  if (lower.includes('top') && !lower.includes('beside')) {
    return { dirX: 0, dirY: 1 };
  }
  if (lower.includes('beside head (left)')) {
    return { dirX: -1, dirY: 0 };
  }
  if (lower.includes('beside head (right)')) {
    return { dirX: 1, dirY: 0 };
  }
  return undefined;
}

/**
 * Map v2-style placement label to canvas anchor and max line width (fraction of cell).
 * `edgeMarginRatio` is 0–0.25 (e.g. 0.06 = 6% inset on each side).
 */
export function layoutFromPlacementLabel(
  label: string,
  width: number,
  height: number,
  edgeMarginRatio: number = 0.06,
  options?: LayoutFromPlacementOptions
): TextPlacementLayout {
  const margin = Math.max(0.02, Math.min(0.22, edgeMarginRatio));
  const marginX = width * margin;
  const marginY = height * margin;
  const maxW = width - marginX * 2;
  const lower = label.toLowerCase();
  const bandH = height * RESERVED_CAPTION_BAND_HEIGHT_RATIO;
  const useBand = options?.useReservedCaptionBandAnchors === true;

  let textAlign: CanvasTextAlign = 'center';
  let textBaseline: CanvasTextBaseline = 'bottom';
  let anchorX = width / 2;
  let anchorY = height - marginY;
  let maxWidth = maxW;

  if (lower.includes('middle center')) {
    textAlign = 'center';
    textBaseline = 'middle';
    anchorX = width / 2;
    anchorY = useBand ? height / 2 : height / 2;
  } else if (lower.includes('top center')) {
    textBaseline = 'top';
    anchorY = useBand ? marginY + bandH * 0.12 : marginY;
  } else if (lower.includes('bottom center')) {
    textBaseline = 'bottom';
    anchorY = useBand ? height - marginY - bandH * 0.06 : height - marginY;
  } else if (lower.includes('top left')) {
    textAlign = 'left';
    textBaseline = 'top';
    anchorX = marginX;
    anchorY = useBand ? marginY + bandH * 0.12 : marginY;
    maxWidth = useBand ? width * 0.55 : maxW;
  } else if (lower.includes('top right')) {
    textAlign = 'right';
    textBaseline = 'top';
    anchorX = width - marginX;
    anchorY = useBand ? marginY + bandH * 0.12 : marginY;
    maxWidth = useBand ? width * 0.55 : maxW;
  } else if (lower.includes('bottom left')) {
    textAlign = 'left';
    textBaseline = 'bottom';
    anchorX = marginX;
    anchorY = useBand ? height - marginY - bandH * 0.06 : height - marginY;
    maxWidth = useBand ? width * 0.55 : maxW;
  } else if (lower.includes('bottom right')) {
    textAlign = 'right';
    textBaseline = 'bottom';
    anchorX = width - marginX;
    anchorY = useBand ? height - marginY - bandH * 0.06 : height - marginY;
    maxWidth = useBand ? width * 0.55 : maxW;
  } else if (lower.includes('beside head (left)')) {
    textAlign = 'left';
    textBaseline = 'middle';
    anchorX = useBand ? width * 0.14 : width * 0.2;
    anchorY = height * 0.42;
    maxWidth = useBand ? width * 0.36 : maxW * 0.45;
  } else if (lower.includes('beside head (right)')) {
    textAlign = 'right';
    textBaseline = 'middle';
    anchorX = useBand ? width * 0.86 : width * 0.8;
    anchorY = height * 0.42;
    maxWidth = useBand ? width * 0.36 : maxW * 0.45;
  } else if (lower.includes('diagonal')) {
    textAlign = 'center';
    textBaseline = 'middle';
    anchorX = useBand ? width * 0.62 : width / 2;
    anchorY = useBand ? height * 0.76 : height * 0.72;
    maxWidth = useBand ? width * 0.5 : maxW;
  } else if (lower.includes('beside head')) {
    textAlign = 'center';
    textBaseline = 'middle';
    anchorX = width / 2;
    anchorY = height * 0.72;
  }

  return { anchorX, anchorY, textAlign, textBaseline, maxWidth };
}

/** First line Y for multi-line draw given anchor and canvas baseline. */
export function textStartYFromAnchor(
  anchorY: number,
  lineCount: number,
  lineHeight: number,
  textBaseline: CanvasTextBaseline
): number {
  const totalTextHeight = lineCount * lineHeight;
  if (textBaseline === 'bottom') {
    return anchorY - (lineCount - 1) * lineHeight;
  }
  if (textBaseline === 'middle') {
    return anchorY - totalTextHeight / 2 + lineHeight / 2;
  }
  return anchorY;
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  const pushWord = (word: string) => {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
      return;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      return;
    }
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (ctx.measureText(next).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    line = chunk;
  };

  for (const w of words) {
    pushWord(w);
  }
  if (line) lines.push(line);

  if (lines.length === 0) return [trimmed];
  return lines;
}

/** Axis-aligned rectangle in pixel space. */
export type PixelRect = { minX: number; minY: number; maxX: number; maxY: number };

export function rectangleIntersectionArea(a: PixelRect, b: PixelRect): number {
  const iw = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const ih = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (iw <= 0 || ih <= 0) return 0;
  return iw * ih;
}

/** Expand a rectangle inward from frame edges, clamped to the canvas. */
export function inflatePixelRect(
  box: PixelRect,
  padX: number,
  padY: number,
  width: number,
  height: number
): PixelRect {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    minX: clamp(box.minX - padX, 0, width - 1),
    minY: clamp(box.minY - padY, 0, height - 1),
    maxX: clamp(box.maxX + padX, 0, width - 1),
    maxY: clamp(box.maxY + padY, 0, height - 1),
  };
}

export function shiftPixelRect(box: PixelRect, dx: number, dy: number): PixelRect {
  return {
    minX: box.minX + dx,
    minY: box.minY + dy,
    maxX: box.maxX + dx,
    maxY: box.maxY + dy,
  };
}

export function textBoxFitsFrameInset(
  box: PixelRect,
  width: number,
  height: number,
  inset: number
): boolean {
  return (
    box.minX >= inset &&
    box.minY >= inset &&
    box.maxX <= width - inset &&
    box.maxY <= height - inset
  );
}

/** Shift so the text AABB lies inside the frame inset (visibility over perfect avoid). */
export function correctionToFitTextBoxInFrame(
  box: PixelRect,
  width: number,
  height: number,
  inset: number
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (box.minX < inset) {
    dx += inset - box.minX;
  }
  if (box.maxX > width - inset) {
    dx -= box.maxX - (width - inset);
  }
  if (box.minY < inset) {
    dy += inset - box.minY;
  }
  if (box.maxY > height - inset) {
    dy -= box.maxY - (height - inset);
  }
  return { dx, dy };
}

/** Padding around measured glyphs for stroke and descenders when scoring auto-avoid. */
export function textOverlayAvoidancePadPx(
  fontSize: number,
  strokeMult: number
): { padX: number; padY: number } {
  const strokeW = Math.max(1.5, fontSize * 0.12 * strokeMult);
  const strokeExtent = strokeW * 2;
  return {
    padX: Math.ceil(strokeExtent + fontSize * 0.12),
    padY: Math.ceil(strokeExtent + fontSize * 0.16),
  };
}

/** Minimum gap between two non-overlapping axis-aligned rectangles (0 if overlapping). */
export function rectangleMinSeparation(a: PixelRect, b: PixelRect): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

/**
 * Rough bounding box for multi-line sticker text from anchor, alignment, and line metrics.
 * Uses layout max width (full caption band); prefer {@link estimateTextBlockBoxFromMeasuredLines}
 * for auto-avoid scoring where tighter boxes improve placement.
 */
export function estimateTextBlockBox(
  width: number,
  height: number,
  layout: TextPlacementLayout,
  lineCount: number,
  lineHeight: number
): PixelRect {
  const totalH = Math.max(lineHeight, lineCount * lineHeight);
  let top = layout.anchorY;
  let bottom = layout.anchorY;
  if (layout.textBaseline === 'bottom') {
    bottom = layout.anchorY;
    top = layout.anchorY - totalH;
  } else if (layout.textBaseline === 'top') {
    top = layout.anchorY;
    bottom = layout.anchorY + totalH;
  } else {
    top = layout.anchorY - totalH / 2;
    bottom = layout.anchorY + totalH / 2;
  }

  let left = layout.anchorX;
  let right = layout.anchorX;
  const mw = layout.maxWidth;
  if (layout.textAlign === 'left') {
    left = layout.anchorX;
    right = layout.anchorX + mw;
  } else if (layout.textAlign === 'right') {
    left = layout.anchorX - mw;
    right = layout.anchorX;
  } else {
    left = layout.anchorX - mw / 2;
    right = layout.anchorX + mw / 2;
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    minX: clamp(left, 0, width),
    minY: clamp(top, 0, height),
    maxX: clamp(right, 0, width),
    maxY: clamp(bottom, 0, height),
  };
}

/**
 * Tighter text AABB from measured line widths and {@link TextPlacementLayout} alignment.
 * Optional pads approximate stroke / descenders so auto-avoid does not hug glyph edges.
 */
export function estimateTextBlockBoxFromMeasuredLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: TextPlacementLayout,
  lines: string[],
  lineHeight: number,
  horizontalPadPx: number = 0,
  verticalPadPx: number = 0
): PixelRect {
  const rows = lines.length > 0 ? lines : [''];
  const lineWidths = rows.map((line) => ctx.measureText(line.length > 0 ? line : ' ').width);
  const maxLineW = Math.max(...lineWidths, 1);
  const lineCount = rows.length;
  const totalH = Math.max(lineHeight, lineCount * lineHeight);

  let top = layout.anchorY;
  let bottom = layout.anchorY;
  if (layout.textBaseline === 'bottom') {
    bottom = layout.anchorY;
    top = layout.anchorY - totalH;
  } else if (layout.textBaseline === 'top') {
    top = layout.anchorY;
    bottom = layout.anchorY + totalH;
  } else {
    top = layout.anchorY - totalH / 2;
    bottom = layout.anchorY + totalH / 2;
  }

  const ax = layout.anchorX;
  let left: number;
  let right: number;
  if (layout.textAlign === 'left') {
    left = ax;
    right = ax + maxLineW;
  } else if (layout.textAlign === 'right') {
    left = ax - maxLineW;
    right = ax;
  } else {
    left = ax - maxLineW / 2;
    right = ax + maxLineW / 2;
  }

  const padX = horizontalPadPx;
  const padY = verticalPadPx;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    minX: clamp(left - padX, 0, width),
    minY: clamp(top - padY, 0, height),
    maxX: clamp(right + padX, 0, width),
    maxY: clamp(bottom + padY, 0, height),
  };
}
