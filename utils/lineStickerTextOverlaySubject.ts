/**
 * Subject (foreground) detection and caption auto-avoidance for LINE sticker overlay.
 * Scans a frame raster for the opaque/non-chroma subject bbox, then chooses or nudges
 * the caption placement so text does not cover the subject. Extracted from
 * lineStickerTextOverlay.ts; depends on the pure geometry helpers.
 */

import {
  getLineStickerTextPlacementLabel,
  getReservedCaptionBandLabelForFrame,
  LINE_STICKER_TEXT_PLACEMENT_PRESETS,
} from './lineStickerPrompt';
import {
  type PixelRect,
  rectangleIntersectionArea,
  inflatePixelRect,
  shiftPixelRect,
  textBoxFitsFrameInset,
  correctionToFitTextBoxInFrame,
  textOverlayAvoidancePadPx,
  rectangleMinSeparation,
  layoutFromPlacementLabel,
  wrapLines,
  estimateTextBlockBoxFromMeasuredLines,
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

export function subjectAvoidanceRegion(
  subject: PixelRect,
  width: number,
  height: number,
  fontSize: number
): PixelRect {
  const bodyPad = Math.ceil(Math.min(width, height) * 0.02 + fontSize * 0.05);
  return inflatePixelRect(subject, bodyPad, bodyPad, width, height);
}

export function frameInsetPx(width: number, height: number, marginRatio: number): number {
  return Math.max(2, Math.round(Math.min(width, height) * marginRatio));
}

export function pickBestPlacementLabelAutoAvoid(
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
