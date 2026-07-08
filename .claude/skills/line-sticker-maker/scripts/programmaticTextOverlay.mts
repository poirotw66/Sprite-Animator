/**
 * Headless programmatic caption overlay for the LINE sticker skill.
 * Mirrors the browser pipeline in lineStickerTextOverlay.ts using @napi-rs/canvas.
 */

import { createCanvas } from '@napi-rs/canvas';
import {
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  getReservedCaptionBandLabelForFrame,
} from '../../../../utils/lineStickerPrompt.ts';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  type ProgrammaticTextOverlayTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';
import { computeAutoCaptionLayout } from '../../../../utils/lineStickerTextOverlaySubject.ts';
import {
  extractFillHexFromTextColorPreset,
  resolveCanvasFontNumericWeight,
  resolveProgrammaticFontFamilyCss,
  resolveProgrammaticPlacementLabel,
  getEffectiveProgrammaticPlacementMode,
  strokeColorForFill,
} from '../../../../utils/lineStickerTextOverlay.ts';
import type { RgbaImage } from './nodeImage.mts';

type FontPresetKey = keyof typeof FONT_PRESETS;
type TextColorPresetKey = keyof typeof TEXT_COLOR_PRESETS;

export interface ProgrammaticOverlayOptions {
  fontKey?: FontPresetKey;
  colorKey?: TextColorPresetKey;
  tuning?: ProgrammaticTextOverlayTuning;
  frameIndex?: number;
}

function blitRgbaOntoCanvas(
  ctx: NonNullable<ReturnType<ReturnType<typeof createCanvas>['getContext']>>,
  frame: RgbaImage
): void {
  const imgData = ctx.createImageData(frame.width, frame.height);
  imgData.data.set(frame.data);
  ctx.putImageData(imgData, 0, 0);
}

function readRgbaFromCanvas(canvas: ReturnType<typeof createCanvas>): RgbaImage {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: new Uint8ClampedArray(data), width, height };
}

/** Draw phrase text onto one sliced sticker frame (RGBA buffer). */
export function overlayPhraseOnRgbaFrame(
  frame: RgbaImage,
  phrase: string,
  options: ProgrammaticOverlayOptions = {}
): RgbaImage {
  const trimmed = phrase.trim();
  if (!trimmed) {
    return frame;
  }

  const fontKey = options.fontKey ?? 'round';
  const colorKey = options.colorKey ?? 'black';
  const frameIndex = options.frameIndex ?? 0;
  const tuning = options.tuning ?? DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING;
  const sizeRatio = Math.max(0.04, Math.min(0.2, tuning.fontSizePercent / 100));
  const marginRatio = Math.max(0.02, Math.min(0.18, tuning.edgeMarginPercent / 100));
  const lineMult = Math.max(1.02, Math.min(1.8, tuning.lineHeightMultiplier));
  const strokeMult = Math.max(0.5, Math.min(2.5, tuning.strokeScale));

  const canvas = createCanvas(frame.width, frame.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return frame;
  }
  blitRgbaOntoCanvas(ctx, frame);

  const fontFamily = resolveProgrammaticFontFamilyCss(fontKey, tuning);
  const numericWeight = resolveCanvasFontNumericWeight(fontKey, tuning);
  const mode = getEffectiveProgrammaticPlacementMode(tuning, frameIndex);
  const preferredLabel =
    mode === 'auto_avoid_subject' || mode === 'cycle'
      ? getReservedCaptionBandLabelForFrame(frameIndex)
      : resolveProgrammaticPlacementLabel(frameIndex, tuning);

  const layout = computeAutoCaptionLayout(ctx, {
    width: frame.width,
    height: frame.height,
    text: trimmed,
    preferredLabel,
    marginRatio,
    lineHeightMultiplier: lineMult,
    strokeScale: strokeMult,
    baseFontSizePx: Math.max(10, Math.round(Math.min(frame.width, frame.height) * sizeRatio)),
    applyFont: (px) => {
      ctx.font = `${numericWeight} ${px}px ${fontFamily}`;
    },
  });

  const fillHex = extractFillHexFromTextColorPreset(colorKey);
  const strokeHex = strokeColorForFill(fillHex);
  const strokeW = Math.max(1.5, layout.fontSize * 0.12 * strokeMult);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const offsetX = (frame.width * tuning.offsetXPercent) / 100;
  const offsetY = (frame.height * tuning.offsetYPercent) / 100;
  const firstLineY =
    layout.centerY + offsetY - ((layout.lines.length - 1) / 2) * layout.lineHeight;

  layout.lines.forEach((line, i) => {
    const y = firstLineY + i * layout.lineHeight;
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = strokeW * 2;
    ctx.strokeText(line, layout.centerX + offsetX, y);
    ctx.fillStyle = fillHex;
    ctx.fillText(line, layout.centerX + offsetX, y);
  });

  return readRgbaFromCanvas(canvas);
}

/** Apply programmatic captions to every frame in a sheet slice batch. */
export function overlayPhrasesOnRgbaFrames(
  frames: RgbaImage[],
  phrases: string[],
  options: Omit<ProgrammaticOverlayOptions, 'frameIndex'> = {}
): RgbaImage[] {
  return frames.map((frame, i) =>
    overlayPhraseOnRgbaFrame(frame, phrases[i] ?? '', { ...options, frameIndex: i })
  );
}
