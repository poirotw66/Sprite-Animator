/**
 * Compose LINE sticker frames on a fixed work canvas: disjoint caption + subject slots.
 */

import { createCanvas } from '@napi-rs/canvas';
import { getReservedCaptionBandLabelForFrame } from './lineStickerPrompt';
import { wrapLinesWithSpacing } from './lineStickerTextOverlayGeometry';
import {
  mergeProgrammaticComposeConfig,
  mergeProgrammaticTextTuning,
  resolvePhraseAdaptiveCaptionTuning,
  programmaticTextStrokeWidthPx,
  type ProgrammaticComposeConfig,
  type ProgrammaticTextOverlayTuning,
} from './lineStickerTextOverlayTypes';
import {
  captionFontSizePx,
  fitSubjectPlacement,
  resolveComposeSlots,
  resolveEffectiveComposePreset,
  WORK_CANVAS_HEIGHT,
  WORK_CANVAS_WIDTH,
  type ComposeSlots,
} from './lineStickerComposeLayout';
import type { RgbaFrameBuffer } from './sheetComponentSlicer';
import { trimFrameToContent } from './sheetComponentSlicer';
import { computeFitDimensions, toEvenDimension, LINE_STICKER_UPLOAD } from './lineStickerUploadSpec';
import type { LineStickerFontKey } from './lineStickerPresets';
import { TEXT_COLOR_PRESETS } from './lineStickerPresets';
import { ensureBundledStickerFontsRegistered } from './lineStickerBundledFonts';
import {
  extractFillHexFromTextColorPreset,
  resolveCanvasFontNumericWeight,
  resolveProgrammaticFontFamilyCss,
  strokeColorForFill,
} from './lineStickerTextOverlay';
import { lineWidthWithSpacing } from './lineStickerTextOverlayGeometry';

type TextColorPresetKey = keyof typeof TEXT_COLOR_PRESETS;

/** ponytail: @napi-rs/canvas 2D context is not DOM CanvasRenderingContext2D; narrow API surface for compose. */
interface ComposeCanvas2D {
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: unknown, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  createImageData(w: number, h: number): ImageData;
  putImageData(data: ImageData, x: number, y: number): void;
  measureText(text: string): TextMetrics;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  save(): void;
  restore(): void;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  clip(): void;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
}

interface ComposeCanvasSurface {
  width: number;
  height: number;
  getContext(contextId: '2d'): ComposeCanvas2D | null;
}

function asComposeContext(ctx: unknown): ComposeCanvas2D {
  return ctx as ComposeCanvas2D;
}

export interface ComposeStickerOptions {
  phrase: string;
  frameIndex?: number;
  compose?: ProgrammaticComposeConfig;
  tuning?: ProgrammaticTextOverlayTuning;
  fontKey?: LineStickerFontKey;
  colorKey?: TextColorPresetKey;
}

/** Compose layout applies only when enabled and the frame has caption text. */
export function shouldUseComposeLayout(compose: ProgrammaticComposeConfig, phrase: string): boolean {
  return compose.enabled && phrase.trim().length > 0;
}

function measureOpaqueBounds(frame: RgbaFrameBuffer): PixelBounds | null {
  const { data, width, height } = frame;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return null;
  }
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
}

interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function cropFrame(frame: RgbaFrameBuffer, bounds: PixelBounds): RgbaFrameBuffer {
  const outW = bounds.maxX - bounds.minX;
  const outH = bounds.maxY - bounds.minY;
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = bounds.minY; y < bounds.maxY; y += 1) {
    const srcRow = (y * frame.width + bounds.minX) * 4;
    const dstRow = (y - bounds.minY) * outW * 4;
    out.set(frame.data.subarray(srcRow, srcRow + outW * 4), dstRow);
  }
  return { data: out, width: outW, height: outH };
}

function sampleBilinear(
  src: RgbaFrameBuffer,
  srcX: number,
  srcY: number
): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(srcX)));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(srcY)));
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const tx = srcX - x0;
  const ty = srcY - y0;
  const sample = (x: number, y: number) => {
    const i = (y * src.width + x) * 4;
    return [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!] as const;
  };
  const c00 = sample(x0, y0);
  const c10 = sample(x1, y0);
  const c01 = sample(x0, y1);
  const c11 = sample(x1, y1);
  const channel = (index: number) =>
    Math.round(
      c00[index]! * (1 - tx) * (1 - ty) +
        c10[index]! * tx * (1 - ty) +
        c01[index]! * (1 - tx) * ty +
        c11[index]! * tx * ty
    );
  return [channel(0), channel(1), channel(2), channel(3)];
}

function resampleRgba(src: RgbaFrameBuffer, dstW: number, dstH: number): RgbaFrameBuffer {
  const width = toEvenDimension(dstW);
  const height = toEvenDimension(dstH);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcY = ((y + 0.5) / height) * src.height - 0.5;
    for (let x = 0; x < width; x += 1) {
      const srcX = ((x + 0.5) / width) * src.width - 0.5;
      const [r, g, b, a] = sampleBilinear(src, srcX, srcY);
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return { data, width, height };
}

function drawRgbaFrameOnCanvas(
  ctx: ComposeCanvas2D,
  frame: RgbaFrameBuffer,
  offsetX: number,
  offsetY: number
): void {
  const layer = createCanvas(frame.width, frame.height);
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) {
    return;
  }
  const imgData = layerCtx.createImageData(frame.width, frame.height);
  imgData.data.set(frame.data);
  layerCtx.putImageData(imgData, 0, 0);
  ctx.drawImage(layer, offsetX, offsetY);
}

function readRgbaFromCanvas(canvas: unknown): RgbaFrameBuffer {
  const surface = canvas as ComposeCanvasSurface;
  const ctx = surface.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  const { data, width, height } = ctx.getImageData(0, 0, surface.width, surface.height);
  return { data: new Uint8ClampedArray(data), width, height };
}

/** Pad transparent sides so trimmed stickers read landscape in chat (width > height). */
export function ensureLandscapeStickerFrame(
  frame: RgbaFrameBuffer,
  minAspect: number = 1.05,
  maxWidth: number = LINE_STICKER_UPLOAD.stickerMaxWidth,
  maxHeight: number = LINE_STICKER_UPLOAD.stickerMaxHeight
): RgbaFrameBuffer {
  if (frame.width > frame.height) {
    return frame;
  }

  const aspect = Math.max(1.01, minAspect);
  let content = frame;
  let targetW = toEvenDimension(Math.ceil(content.height * aspect));
  let targetH = toEvenDimension(content.height);

  if (targetW > maxWidth || targetH > maxHeight) {
    const scale = Math.min(maxWidth / targetW, maxHeight / targetH, 1);
    content = resampleRgba(
      content,
      toEvenDimension(content.width * scale),
      toEvenDimension(content.height * scale)
    );
    targetH = content.height;
    targetW = toEvenDimension(Math.min(maxWidth, Math.ceil(targetH * aspect)));
  }

  if (content.width >= targetW && content.width > content.height) {
    return content;
  }

  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return content;
  }
  ctx.clearRect(0, 0, targetW, targetH);
  drawRgbaFrameOnCanvas(
    asComposeContext(ctx),
    content,
    Math.floor((targetW - content.width) / 2),
    Math.floor((targetH - content.height) / 2)
  );
  return readRgbaFromCanvas(canvas);
}

/** Stroke+fill one line char by char so CJK captions get visible letter spacing. */
function drawLineWithSpacing(
  ctx: ComposeCanvas2D,
  line: string,
  centerX: number,
  y: number,
  spacingPx: number,
  strokeHex: string,
  fillHex: string,
  strokeW: number
): void {
  const chars = Array.from(line);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total =
    widths.reduce((a, b) => a + b, 0) + spacingPx * Math.max(0, chars.length - 1);
  let x = centerX - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = strokeW * 2;
    ctx.strokeText(ch, x, y);
    ctx.fillStyle = fillHex;
    ctx.fillText(ch, x, y);
    x += widths[i]! + spacingPx;
  });
  ctx.textAlign = prevAlign;
}

function drawGlyph(
  ctx: ComposeCanvas2D,
  glyph: string,
  x: number,
  y: number,
  strokeHex: string,
  fillHex: string,
  strokeW: number
): void {
  ctx.strokeStyle = strokeHex;
  ctx.lineWidth = strokeW * 2;
  ctx.strokeText(glyph, x, y);
  ctx.fillStyle = fillHex;
  ctx.fillText(glyph, x, y);
}

function verticalCaptionHeight(
  glyphCount: number,
  lineHeight: number,
  letterSpacingPx: number
): number {
  if (glyphCount <= 0) {
    return 0;
  }
  return glyphCount * lineHeight + Math.max(0, glyphCount - 1) * letterSpacingPx;
}

function resolveCaptionLayout(
  ctx: ComposeCanvas2D,
  phrase: string,
  slots: ComposeSlots,
  tuning: ProgrammaticTextOverlayTuning,
  canvasWidth: number,
  canvasHeight: number,
  fontKey: ComposeStickerOptions['fontKey'],
  letterSpacingEm: number
): {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  centerX: number;
  centerY: number;
  letterSpacingPx: number;
  captionOrientation: ComposeSlots['captionOrientation'];
} {
  const { captionSlot, captionAlign, captionOrientation } = slots;
  const slotW = captionSlot.maxX - captionSlot.minX;
  const slotH = captionSlot.maxY - captionSlot.minY;
  const maxWidth = Math.max(8, slotW * 0.92);
  let fontSize = captionFontSizePx(canvasWidth, canvasHeight, tuning.fontSizePercent);
  const minFont = 16;
  const lineMult = Math.max(1.02, Math.min(1.8, tuning.lineHeightMultiplier));
  const key = fontKey ?? 'round';
  const applyFont = (px: number) => {
    ctx.font = `${resolveCanvasFontNumericWeight(key, tuning)} ${px}px ${resolveProgrammaticFontFamilyCss(key, tuning)}`;
  };

  let lines: string[] = [];
  let lineHeight = fontSize * lineMult;
  let letterSpacingPx = fontSize * letterSpacingEm;

  if (captionOrientation === 'vertical') {
    lines = Array.from(phrase);
    while (fontSize >= minFont) {
      lineHeight = fontSize * lineMult;
      letterSpacingPx = fontSize * letterSpacingEm;
      const blockH = verticalCaptionHeight(lines.length, lineHeight, letterSpacingPx);
      if (fontSize <= slotW * 0.94 && blockH <= slotH * 0.96) {
        break;
      }
      fontSize -= 1;
    }
    applyFont(fontSize);
    letterSpacingPx = fontSize * letterSpacingEm;
  } else {
    while (fontSize >= minFont) {
      applyFont(fontSize);
      letterSpacingPx = fontSize * letterSpacingEm;
      lines = wrapLinesWithSpacing(
        ctx as unknown as CanvasRenderingContext2D,
        phrase,
        maxWidth,
        letterSpacingPx
      );
      lineHeight = fontSize * lineMult;
      const widest = lines.reduce(
        (w, line) =>
          Math.max(
            w,
            lineWidthWithSpacing(ctx as unknown as CanvasRenderingContext2D, line, letterSpacingPx)
          ),
        0
      );
      if (lines.length * lineHeight <= slotH * 0.92 && widest <= maxWidth) {
        break;
      }
      fontSize -= 1;
    }
  }

  let centerX = (captionSlot.minX + captionSlot.maxX) / 2;
  if (captionOrientation === 'horizontal' && captionAlign !== 'center') {
    const widest = lines.reduce(
      (w, line) =>
        Math.max(
          w,
          lineWidthWithSpacing(ctx as unknown as CanvasRenderingContext2D, line, letterSpacingPx)
        ),
      0
    );
    const pad = slotW * 0.04;
    centerX =
      captionAlign === 'left'
        ? captionSlot.minX + pad + widest / 2
        : captionSlot.maxX - pad - widest / 2;
  }
  const centerY = (captionSlot.minY + captionSlot.maxY) / 2;
  return {
    lines,
    fontSize,
    lineHeight,
    centerX,
    centerY,
    letterSpacingPx,
    captionOrientation,
  };
}

/** Compose one sticker: subject + caption on a fixed work canvas, then fit to LINE limits. */
export function composeStickerFrame(
  subjectFrame: RgbaFrameBuffer,
  options: ComposeStickerOptions
): RgbaFrameBuffer {
  ensureBundledStickerFontsRegistered();
  const compose = mergeProgrammaticComposeConfig(options.compose);
  const tuning = mergeProgrammaticTextTuning({
    ...options.tuning,
    ...compose.tuning,
    fontSizeMode: compose.tuning?.fontSizeMode ?? options.tuning?.fontSizeMode ?? 'auto',
  });
  const fontKey = options.fontKey ?? 'round';
  const colorKey = options.colorKey ?? 'black';
  const frameIndex = options.frameIndex ?? 0;
  const phrase = options.phrase.trim();
  if (!shouldUseComposeLayout(compose, phrase)) {
    return subjectFrame;
  }

  const baseFontSizePercent =
    compose.tuning?.fontSizePercent ?? tuning.fontSizePercent;
  const baseLetterSpacingEm = compose.captionLetterSpacingEm ?? 0.16;
  const adaptive =
    compose.phraseLengthAdaptive !== false
      ? resolvePhraseAdaptiveCaptionTuning(phrase, baseFontSizePercent, baseLetterSpacingEm)
      : { fontSizePercent: baseFontSizePercent, letterSpacingEm: baseLetterSpacingEm };
  const effectiveTuning = mergeProgrammaticTextTuning({
    ...tuning,
    ...compose.tuning,
    fontSizePercent: adaptive.fontSizePercent,
    fontSizeMode: compose.tuning?.fontSizeMode ?? options.tuning?.fontSizeMode ?? 'auto',
  });

  const canvasW = compose.workCanvas?.width ?? WORK_CANVAS_WIDTH;
  const canvasH = compose.workCanvas?.height ?? WORK_CANVAS_HEIGHT;
  const marginRatio = Math.max(0.02, Math.min(0.18, effectiveTuning.edgeMarginPercent / 100));
  const layout = compose.layout ?? 'top_caption_bottom_subject';
  const preset = resolveEffectiveComposePreset(
    layout,
    frameIndex,
    getReservedCaptionBandLabelForFrame
  );
  const lineMult = Math.max(1.02, Math.min(1.8, effectiveTuning.lineHeightMultiplier));
  const slots = resolveComposeSlots(preset, canvasW, canvasH, marginRatio, {
    fontSizePx: captionFontSizePx(canvasW, canvasH, effectiveTuning.fontSizePercent),
    lineHeightMultiplier: lineMult,
  });

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = asComposeContext(canvas.getContext('2d'));
  ctx.clearRect(0, 0, canvasW, canvasH);

  let subject = subjectFrame;
  if (compose.subjectTrim === 'content') {
    const bounds = measureOpaqueBounds(subjectFrame);
    if (bounds) {
      subject = cropFrame(subjectFrame, bounds);
    }
  }

  const bounds = measureOpaqueBounds(subject);
  if (bounds) {
    const cropped = cropFrame(subject, bounds);
    const placement = fitSubjectPlacement(
      cropped.width,
      cropped.height,
      slots.subjectSlot,
      slots.subjectAnchor,
      compose.subjectScale ?? slots.subjectScale ?? 1.28
    );
    const scaled =
      placement.drawWidth === cropped.width && placement.drawHeight === cropped.height
        ? cropped
        : resampleRgba(cropped, placement.drawWidth, placement.drawHeight);
    drawRgbaFrameOnCanvas(ctx, scaled, placement.offsetX, placement.offsetY);
  }

  {
    const fontFamily = resolveProgrammaticFontFamilyCss(fontKey, effectiveTuning);
    const numericWeight = resolveCanvasFontNumericWeight(fontKey, effectiveTuning);
    const strokeMult = Math.max(0.5, Math.min(2.5, effectiveTuning.strokeScale));
    const letterSpacingEm = Math.max(0, Math.min(0.4, adaptive.letterSpacingEm));
    const layoutResult = resolveCaptionLayout(
      ctx,
      phrase,
      slots,
      effectiveTuning,
      canvasW,
      canvasH,
      fontKey,
      letterSpacingEm
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      slots.captionSlot.minX,
      slots.captionSlot.minY,
      slots.captionSlot.maxX - slots.captionSlot.minX,
      slots.captionSlot.maxY - slots.captionSlot.minY
    );
    ctx.clip();

    ctx.font = `${numericWeight} ${layoutResult.fontSize}px ${fontFamily}`;
    const fillHex = extractFillHexFromTextColorPreset(colorKey);
    const strokeHex = strokeColorForFill(fillHex);
    const strokeW = programmaticTextStrokeWidthPx(layoutResult.fontSize, strokeMult);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const offsetX = (canvasW * effectiveTuning.offsetXPercent) / 100;
    const offsetY = (canvasH * effectiveTuning.offsetYPercent) / 100;

    if (layoutResult.captionOrientation === 'vertical') {
      const blockH = verticalCaptionHeight(
        layoutResult.lines.length,
        layoutResult.lineHeight,
        layoutResult.letterSpacingPx
      );
      const firstY =
        layoutResult.centerY + offsetY - blockH / 2 + layoutResult.lineHeight / 2;
      layoutResult.lines.forEach((glyph, i) => {
        const y =
          firstY + i * (layoutResult.lineHeight + layoutResult.letterSpacingPx);
        drawGlyph(
          ctx,
          glyph,
          layoutResult.centerX + offsetX,
          y,
          strokeHex,
          fillHex,
          strokeW
        );
      });
    } else {
      const firstLineY =
        layoutResult.centerY +
        offsetY -
        ((layoutResult.lines.length - 1) / 2) * layoutResult.lineHeight;

      layoutResult.lines.forEach((line, i) => {
        const y = firstLineY + i * layoutResult.lineHeight;
        if (layoutResult.letterSpacingPx > 0 && Array.from(line).length > 1) {
          drawLineWithSpacing(
            ctx,
            line,
            layoutResult.centerX + offsetX,
            y,
            layoutResult.letterSpacingPx,
            strokeHex,
            fillHex,
            strokeW
          );
        } else {
          drawGlyph(
            ctx,
            line,
            layoutResult.centerX + offsetX,
            y,
            strokeHex,
            fillHex,
            strokeW
          );
        }
      });
    }
    ctx.restore();
  }

  let output = readRgbaFromCanvas(canvas);
  const fit = computeFitDimensions(output.width, output.height, WORK_CANVAS_WIDTH, WORK_CANVAS_HEIGHT);
  if (fit.width !== output.width || fit.height !== output.height) {
    output = resampleRgba(output, fit.width, fit.height);
  }
  if (compose.trimAfterCompose) {
    output = trimFrameToContent(output, compose.trimMarginRatio ?? 0.06);
    const evenW = toEvenDimension(output.width);
    const evenH = toEvenDimension(output.height);
    if (evenW !== output.width || evenH !== output.height) {
      output = resampleRgba(output, evenW, evenH);
    }
    if (compose.preferLandscapeAspect !== false) {
      output = ensureLandscapeStickerFrame(
        output,
        compose.minLandscapeAspect ?? 1.05,
        LINE_STICKER_UPLOAD.stickerMaxWidth,
        LINE_STICKER_UPLOAD.stickerMaxHeight
      );
    }
  }
  return output;
}
