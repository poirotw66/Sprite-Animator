/**
 * Browser-only: draw LINE sticker phrase text onto a sliced frame (data URL PNG).
 * Used when textRendering is programmatic so the image model omits text.
 */

import {
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  getLineStickerTextPlacementLabel,
  getReservedCaptionBandLabelForFrame,
  RESERVED_CAPTION_BAND_HEIGHT_RATIO,
  LINE_STICKER_TEXT_PLACEMENT_PRESETS,
} from './lineStickerPrompt';

import type {
  ProgrammaticTextPlacementMode,
  ProgrammaticFontFamilySource,
  ProgrammaticTextOverlayTuning,
} from './lineStickerTextOverlayTypes';
import { DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING } from './lineStickerTextOverlayTypes';

// Re-export so existing importers of './lineStickerTextOverlay' keep working.
export type {
  ProgrammaticTextPlacementMode,
  ProgrammaticFontFamilySource,
  ProgrammaticTextOverlayTuning,
};
export { DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING };

type FontPresetKey = keyof typeof FONT_PRESETS;
type TextColorPresetKey = keyof typeof TEXT_COLOR_PRESETS;

const HEX_IN_PROMPT = /#([0-9A-Fa-f]{6})\b/;

/** Effective placement mode for a frame (global mode or per-frame override). */
export function getEffectiveProgrammaticPlacementMode(
  tuning: ProgrammaticTextOverlayTuning,
  frameIndex: number
): ProgrammaticTextPlacementMode {
  const override = tuning.placementModeOverrides?.[frameIndex];
  return override ?? tuning.placementMode;
}

/**
 * Resolve placement label for layout (cycle, fixed anchors). Does not handle auto_avoid_subject;
 * that mode is resolved in overlayLineStickerTextOnFrame after raster analysis.
 */
export function resolveProgrammaticPlacementLabel(
  frameIndex: number,
  tuning: ProgrammaticTextOverlayTuning
): string {
  const mode = getEffectiveProgrammaticPlacementMode(tuning, frameIndex);
  if (mode === 'cycle') {
    return getReservedCaptionBandLabelForFrame(frameIndex);
  }
  if (mode === 'auto_avoid_subject') {
    return 'Bottom center';
  }
  if (mode === 'bottom_center') return 'Bottom center';
  if (mode === 'top_center') return 'Top center';
  return 'Middle center';
}

/** Extract #RRGGBB from preset promptDesc (e.g. "Black #000000"). */
export function extractFillHexFromTextColorPreset(colorKey: TextColorPresetKey): string {
  const desc = TEXT_COLOR_PRESETS[colorKey]?.promptDesc ?? '';
  const m = desc.match(HEX_IN_PROMPT);
  return m ? `#${m[1]}` : '#000000';
}

function luminance(hex: string): number {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** High-contrast stroke for sticker readability on transparent / chroma backgrounds. */
export function strokeColorForFill(fillHex: string): string {
  return luminance(fillHex) > 0.55 ? '#1a1a1a' : '#ffffff';
}

/**
 * System font stacks for canvas. The browser uses the first installed family.
 * Stacks are chosen to approximate each FONT_PRESETS prompt (not decorative
 * model-only effects). Several "rounded bubble" styles share the same nearest
 * system round sans; they stay honest to that limit rather than forcing odd faces.
 */
export function fontCssStackForPreset(fontKey: FontPresetKey): string {
  const stacks: Record<FontPresetKey, string> = {
    handwritten:
      '"Kaiti TC", "DFKai-SB", "BiauKai", "Bradley Hand ITC", "Microsoft JhengHei", sans-serif',
    round:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei UI", "PingFang TC", sans-serif',
    bold:
      '"Heiti TC", "STHeiti", "PingFang TC", "Microsoft JhengHei", "Hiragino Sans", "Noto Sans TC", sans-serif',
    cute:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Chalkboard SE", "Microsoft JhengHei", "PingFang TC", sans-serif',
    pop:
      '"PingFang TC", "Hiragino Sans", "Microsoft JhengHei", "Helvetica Neue", "Segoe UI", sans-serif',
    pinkBubble:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei UI", "PingFang TC", sans-serif',
    thinHandwritten:
      '"Bradley Hand ITC", "Snell Roundhand", "Kaiti TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    custom:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei UI", "PingFang TC", sans-serif',
  };
  return stacks[fontKey] ?? stacks.round;
}

/**
 * Numeric weight for canvas `font`. Some presets bias lighter so the glyph matches
 * the prompt (e.g. thin hand-drawn) without ignoring the user's weight control.
 */
export function resolveCanvasFontNumericWeight(
  fontKey: FontPresetKey,
  tuning: ProgrammaticTextOverlayTuning
): number {
  const w = tuning.fontWeight;
  if (fontKey === 'thinHandwritten') {
    return Math.min(w, 600);
  }
  return w;
}

/** Canvas `font` family stack: preset keys or custom CSS from tuning. */
export function resolveProgrammaticFontFamilyCss(
  fontKey: FontPresetKey,
  tuning: ProgrammaticTextOverlayTuning
): string {
  if (tuning.fontFamilySource === 'custom' && tuning.customFontFamily.trim().length > 0) {
    return tuning.customFontFamily.trim();
  }
  return fontCssStackForPreset(fontKey);
}

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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function shiftPixelRect(box: PixelRect, dx: number, dy: number): PixelRect {
  return {
    minX: box.minX + dx,
    minY: box.minY + dy,
    maxX: box.maxX + dx,
    maxY: box.maxY + dy,
  };
}

function textBoxFitsFrameInset(
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

/** Options for {@link computeSubjectBoundingBoxFromContext}. */
export interface SubjectBoundingBoxScanOptions {
  /** Horizontal and vertical pixel step when reading pixels (>= 1). Default 2. */
  sampleStep?: number;
  /**
   * Longest frame side (px) used for analysis. Frames larger than this are downscaled
   * for scanning, then the bbox is mapped back to full resolution (faster, slightly coarser).
   * Default 256. Set very high to always scan at full resolution.
   */
  maxAnalysisSide?: number;
}

function scanForegroundBoundingBoxPixels(
  readCtx: CanvasRenderingContext2D,
  scanWidth: number,
  scanHeight: number,
  step: number
): PixelRect | null {
  let minX = scanWidth;
  let minY = scanHeight;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  const s = Math.max(1, step);
  for (let y = 0; y < scanHeight; y += s) {
    const row = readCtx.getImageData(0, y, scanWidth, 1);
    const d = row.data;
    for (let x = 0; x < scanWidth; x += s) {
      const i = x * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (isForegroundPixel(r, g, b, a)) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!found || maxX < minX || maxY < minY) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function mapAnalyzedBBoxToFullFrame(
  box: PixelRect,
  fullWidth: number,
  fullHeight: number,
  analyzedWidth: number,
  analyzedHeight: number
): PixelRect {
  const sx = fullWidth / analyzedWidth;
  const sy = fullHeight / analyzedHeight;
  return {
    minX: Math.max(0, Math.floor(box.minX * sx)),
    minY: Math.max(0, Math.floor(box.minY * sy)),
    maxX: Math.min(fullWidth - 1, Math.ceil((box.maxX + 1) * sx) - 1),
    maxY: Math.min(fullHeight - 1, Math.ceil((box.maxY + 1) * sy) - 1),
  };
}

/**
 * Bounding box of opaque / non-chroma pixels (downsampled scan). Returns null if no foreground found.
 */
export function computeSubjectBoundingBoxFromContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: SubjectBoundingBoxScanOptions = {}
): PixelRect | null {
  const sampleStep = Math.max(1, options.sampleStep ?? 2);
  const maxAnalysisSide = Math.max(48, options.maxAnalysisSide ?? 256);
  const cw = ctx.canvas?.width ?? width;
  const ch = ctx.canvas?.height ?? height;
  const scanW = Math.min(width, cw);
  const scanH = Math.min(height, ch);
  if (scanW < 1 || scanH < 1) {
    return null;
  }

  const maxDim = Math.max(scanW, scanH);
  const scaleDown = maxDim > maxAnalysisSide ? maxAnalysisSide / maxDim : 1;

  const effectiveStepOnFull = Math.max(
    1,
    Math.min(sampleStep, Math.floor(Math.min(scanW, scanH) / 64) || 1)
  );

  if (scaleDown >= 1 || typeof document === 'undefined' || !ctx.canvas) {
    return scanForegroundBoundingBoxPixels(ctx, scanW, scanH, effectiveStepOnFull);
  }

  const wSmall = Math.max(1, Math.floor(scanW * scaleDown));
  const hSmall = Math.max(1, Math.floor(scanH * scaleDown));
  const buf = document.createElement('canvas');
  buf.width = wSmall;
  buf.height = hSmall;
  const sctx = buf.getContext('2d', { willReadFrequently: true });
  if (!sctx) {
    return scanForegroundBoundingBoxPixels(ctx, scanW, scanH, effectiveStepOnFull);
  }
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(ctx.canvas, 0, 0, scanW, scanH, 0, 0, wSmall, hSmall);

  const smallStep = Math.max(
    1,
    Math.min(sampleStep, Math.floor(Math.min(wSmall, hSmall) / 48) || 1)
  );
  const smallBox = scanForegroundBoundingBoxPixels(sctx, wSmall, hSmall, smallStep);
  if (!smallBox) {
    return null;
  }
  return mapAnalyzedBBoxToFullFrame(smallBox, scanW, scanH, wSmall, hSmall);
}

/**
 * Slide the text box away from the subject centroid until overlap clears, maxShiftPx,
 * or the next step would push text outside the frame inset.
 */
export function computeAnchorNudgeToClearSubject(
  textBox: PixelRect,
  subject: PixelRect,
  width: number,
  height: number,
  maxShiftPx: number,
  frameInsetPx: number = 0,
  preferredDirection?: { dirX: number; dirY: number }
): { dx: number; dy: number } {
  const startOverlap = rectangleIntersectionArea(textBox, subject);
  if (startOverlap <= 0) {
    return { dx: 0, dy: 0 };
  }
  const inset = Math.max(0, frameInsetPx);
  let dirX: number;
  let dirY: number;
  if (preferredDirection) {
    dirX = preferredDirection.dirX;
    dirY = preferredDirection.dirY;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;
  } else {
    const tcx = (textBox.minX + textBox.maxX) / 2;
    const tcy = (textBox.minY + textBox.maxY) / 2;
    const scx = (subject.minX + subject.maxX) / 2;
    const scy = (subject.minY + subject.maxY) / 2;
    dirX = tcx - scx;
    dirY = tcy - scy;
    if (Math.abs(dirX) < 0.5 && Math.abs(dirY) < 0.5) {
      dirY = 1;
    }
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;
  }

  const step = Math.max(2, Math.round(Math.min(width, height) * 0.015));
  const maxSteps = Math.max(1, Math.ceil(maxShiftPx / step));
  const overlapTarget = Math.max(0, startOverlap * 0.12);
  let box = textBox;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < maxSteps; i++) {
    const overlap = rectangleIntersectionArea(box, subject);
    if (overlap <= overlapTarget) {
      break;
    }
    const next = shiftPixelRect(box, dirX * step, dirY * step);
    if (!textBoxFitsFrameInset(next, width, height, inset)) {
      break;
    }
    dx += dirX * step;
    dy += dirY * step;
    box = next;
  }
  const fitted = shiftPixelRect(textBox, dx, dy);
  const pullBack = correctionToFitTextBoxInFrame(fitted, width, height, inset);
  return { dx: dx + pullBack.dx, dy: dy + pullBack.dy };
}

function subjectAvoidanceRegion(
  subject: PixelRect,
  width: number,
  height: number,
  fontSize: number
): PixelRect {
  const bodyPad = Math.ceil(Math.min(width, height) * 0.02 + fontSize * 0.05);
  return inflatePixelRect(subject, bodyPad, bodyPad, width, height);
}

function frameInsetPx(width: number, height: number, marginRatio: number): number {
  return Math.max(2, Math.round(Math.min(width, height) * marginRatio));
}

function pickBestPlacementLabelAutoAvoid(
  ctx: CanvasRenderingContext2D,
  trimmed: string,
  width: number,
  height: number,
  marginRatio: number,
  fontSize: number,
  lineHeight: number,
  strokeMult: number,
  frameIndex: number,
  subjectRaw: PixelRect | null
): string {
  const subject =
    subjectRaw != null ? subjectAvoidanceRegion(subjectRaw, width, height, fontSize) : null;
  if (!subject) {
    return getLineStickerTextPlacementLabel(frameIndex);
  }
  const { padX, padY } = textOverlayAvoidancePadPx(fontSize, strokeMult);
  const inset = frameInsetPx(width, height, marginRatio);
  let bestLabel = LINE_STICKER_TEXT_PLACEMENT_PRESETS[0] ?? 'Bottom center';
  let bestOverlap = Number.POSITIVE_INFINITY;
  let bestGap = -1;
  for (const label of LINE_STICKER_TEXT_PLACEMENT_PRESETS) {
    const layout = layoutFromPlacementLabel(label, width, height, marginRatio, {
      useReservedCaptionBandAnchors: true,
    });
    const lines = wrapLines(ctx, trimmed, layout.maxWidth);
    const textBox = estimateTextBlockBoxFromMeasuredLines(
      ctx,
      width,
      height,
      layout,
      lines,
      lineHeight,
      padX,
      padY
    );
    const overlap = rectangleIntersectionArea(textBox, subject);
    const gap = rectangleMinSeparation(textBox, subject);
    const overflow =
      Math.max(0, inset - textBox.minX) +
      Math.max(0, inset - textBox.minY) +
      Math.max(0, textBox.maxX - (width - inset)) +
      Math.max(0, textBox.maxY - (height - inset));
    const promptBandLabel = getReservedCaptionBandLabelForFrame(frameIndex);
    const promptBandBias = label === promptBandLabel ? 40 : 0;
    const overlapScore = overlap + overflow * 8000 - promptBandBias;
    if (
      overlapScore < bestOverlap ||
      (overlapScore === bestOverlap && gap > bestGap)
    ) {
      bestOverlap = overlapScore;
      bestGap = gap;
      bestLabel = label;
    }
  }
  return bestLabel;
}

export interface LineStickerTextOverlayOptions {
  fontKey: FontPresetKey;
  colorKey: TextColorPresetKey;
  /** Frame index in the sheet (0-based); cycles placement when mode is cycle. */
  frameIndex: number;
  tuning?: ProgrammaticTextOverlayTuning;
  /**
   * When set and the frame is larger, rasterize and draw text on a downscaled canvas,
   * then upscale to the original pixel size (faster preview; slightly softer text).
   */
  previewMaxLongestSide?: number;
}

/**
 * Draw phrase on a sticker frame image. Resolves to the same data URL if phrase is empty or not in browser.
 */
export function overlayLineStickerTextOnFrame(
  frameDataUrl: string,
  phrase: string,
  options: LineStickerTextOverlayOptions
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(frameDataUrl);
  }

  const trimmed = phrase.trim();
  if (!trimmed) {
    return Promise.resolve(frameDataUrl);
  }

  const tuning = options.tuning ?? DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING;
  const sizeRatio = Math.max(0.04, Math.min(0.2, tuning.fontSizePercent / 100));
  const marginRatio = Math.max(0.02, Math.min(0.18, tuning.edgeMarginPercent / 100));
  const lineMult = Math.max(1.02, Math.min(1.8, tuning.lineHeightMultiplier));
  const strokeMult = Math.max(0.5, Math.min(2.5, tuning.strokeScale));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const previewCap = options.previewMaxLongestSide;
        const longest = Math.max(w, h);
        const usePreviewDownscale =
          previewCap != null && previewCap > 0 && longest > previewCap;
        const workW = usePreviewDownscale
          ? Math.max(1, Math.round((w * previewCap!) / longest))
          : w;
        const workH = usePreviewDownscale
          ? Math.max(1, Math.round((h * previewCap!) / longest))
          : h;

        const workCanvas = document.createElement('canvas');
        workCanvas.width = workW;
        workCanvas.height = workH;
        const ctx = workCanvas.getContext('2d');
        if (!ctx) {
          resolve(frameDataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h, 0, 0, workW, workH);

        const fontSize = Math.max(10, Math.round(Math.min(workW, workH) * sizeRatio));
        const fontFamily = resolveProgrammaticFontFamilyCss(options.fontKey, tuning);
        const numericWeight = resolveCanvasFontNumericWeight(options.fontKey, tuning);
        ctx.font = `${numericWeight} ${fontSize}px ${fontFamily}`;

        const fillHex = extractFillHexFromTextColorPreset(options.colorKey);
        const strokeHex = strokeColorForFill(fillHex);
        const lineHeight = fontSize * lineMult;
        const mode = getEffectiveProgrammaticPlacementMode(tuning, options.frameIndex);
        const analysisSide = Math.max(256, Math.min(workW, workH));
        const subjectRaw = computeSubjectBoundingBoxFromContext(ctx, workW, workH, {
          maxAnalysisSide: analysisSide,
        });
        const subjectForAvoid =
          subjectRaw != null
            ? subjectAvoidanceRegion(subjectRaw, workW, workH, fontSize)
            : null;

        let placementLabel: string;
        if (mode === 'auto_avoid_subject') {
          placementLabel = pickBestPlacementLabelAutoAvoid(
            ctx,
            trimmed,
            workW,
            workH,
            marginRatio,
            fontSize,
            lineHeight,
            strokeMult,
            options.frameIndex,
            subjectRaw
          );
        } else {
          placementLabel = resolveProgrammaticPlacementLabel(options.frameIndex, tuning);
        }
        const layout = layoutFromPlacementLabel(placementLabel, workW, workH, marginRatio, {
          useReservedCaptionBandAnchors: true,
        });

        const offsetX = (workW * tuning.offsetXPercent) / 100;
        const offsetY = (workH * tuning.offsetYPercent) / 100;
        let anchorX = layout.anchorX + offsetX;
        let anchorY = layout.anchorY + offsetY;

        ctx.textAlign = layout.textAlign;
        ctx.textBaseline = layout.textBaseline;
        const lines = wrapLines(ctx, trimmed, layout.maxWidth);

        const shouldNudgeForOverlap =
          subjectForAvoid != null &&
          (mode === 'auto_avoid_subject' || mode === 'cycle');
        if (shouldNudgeForOverlap) {
          const { padX, padY } = textOverlayAvoidancePadPx(fontSize, strokeMult);
          const inset = frameInsetPx(workW, workH, marginRatio);
          const layoutAtAnchor: TextPlacementLayout = {
            ...layout,
            anchorX,
            anchorY,
          };
          const textBox = estimateTextBlockBoxFromMeasuredLines(
            ctx,
            workW,
            workH,
            layoutAtAnchor,
            lines,
            lineHeight,
            padX,
            padY
          );
          const maxShift =
            mode === 'auto_avoid_subject'
              ? Math.min(workW, workH) * 0.18
              : Math.min(workW, workH) * 0.1;
          const preferredDir =
            mode === 'cycle'
              ? preferredNudgeDirectionForPlacementLabel(placementLabel)
              : undefined;
          const nudge = computeAnchorNudgeToClearSubject(
            textBox,
            subjectForAvoid,
            workW,
            workH,
            maxShift,
            inset,
            preferredDir
          );
          anchorX += nudge.dx;
          anchorY += nudge.dy;
        }
        const totalTextHeight = lines.length * lineHeight;

        let startY = anchorY;
        if (layout.textBaseline === 'bottom') {
          startY = anchorY - (lines.length - 1) * lineHeight;
        } else if (layout.textBaseline === 'middle') {
          startY = anchorY - totalTextHeight / 2 + lineHeight / 2;
        }

        const strokeW = Math.max(1.5, fontSize * 0.12 * strokeMult);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        lines.forEach((line, i) => {
          const y = startY + i * lineHeight;
          ctx.strokeStyle = strokeHex;
          ctx.lineWidth = strokeW * 2;
          ctx.strokeText(line, anchorX, y);
          ctx.fillStyle = fillHex;
          ctx.fillText(line, anchorX, y);
        });

        if (!usePreviewDownscale) {
          resolve(workCanvas.toDataURL('image/png'));
          return;
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve(workCanvas.toDataURL('image/png'));
          return;
        }
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(workCanvas, 0, 0, workW, workH, 0, 0, w, h);
        resolve(outCanvas.toDataURL('image/png'));
      } catch {
        resolve(frameDataUrl);
      }
    };
    img.onerror = () => reject(new Error('Sticker frame image failed to load'));
    img.src = frameDataUrl;
  });
}

/** Apply overlay to each frame when programmatic text is enabled. */
export async function overlayPhrasesOnStickerFrames(
  frames: string[],
  phrases: string[],
  opts: {
    fontKey: FontPresetKey;
    colorKey: TextColorPresetKey;
    tuning?: ProgrammaticTextOverlayTuning;
    previewMaxLongestSide?: number;
  }
): Promise<string[]> {
  const tuning = opts.tuning ?? DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING;
  const previewMaxLongestSide = opts.previewMaxLongestSide;
  const out = await Promise.all(
    frames.map((frame, i) =>
      overlayLineStickerTextOnFrame(frame, phrases[i] ?? '', {
        fontKey: opts.fontKey,
        colorKey: opts.colorKey,
        frameIndex: i,
        tuning,
        previewMaxLongestSide,
      })
    )
  );
  return out;
}
