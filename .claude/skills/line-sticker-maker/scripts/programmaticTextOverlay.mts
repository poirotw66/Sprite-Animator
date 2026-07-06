/**
 * Headless programmatic caption overlay for the LINE sticker skill.
 * Mirrors the browser pipeline in lineStickerTextOverlay.ts using @napi-rs/canvas.
 */

import { createCanvas } from '@napi-rs/canvas';
import { FONT_PRESETS, TEXT_COLOR_PRESETS } from '../../../../utils/lineStickerPrompt.ts';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  type ProgrammaticTextOverlayTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';
import {
  layoutFromPlacementLabel,
  wrapLines,
  textOverlayAvoidancePadPx,
  estimateTextBlockBoxFromMeasuredLines,
  preferredNudgeDirectionForPlacementLabel,
} from '../../../../utils/lineStickerTextOverlayGeometry.ts';
import type { TextPlacementLayout } from '../../../../utils/lineStickerTextOverlayGeometry.ts';
import {
  computeSubjectBoundingBoxFromContext,
  computeAnchorNudgeToClearSubject,
  subjectAvoidanceRegion,
  pickBestPlacementLabelAutoAvoid,
  frameInsetPx,
} from '../../../../utils/lineStickerTextOverlaySubject.ts';
import {
  extractFillHexFromTextColorPreset,
  fontCssStackForPreset,
  getEffectiveProgrammaticPlacementMode,
  resolveCanvasFontNumericWeight,
  resolveProgrammaticFontFamilyCss,
  resolveProgrammaticPlacementLabel,
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

  const workW = frame.width;
  const workH = frame.height;
  const fontSize = Math.max(10, Math.round(Math.min(workW, workH) * sizeRatio));
  const fontFamily = resolveProgrammaticFontFamilyCss(fontKey, tuning);
  const numericWeight = resolveCanvasFontNumericWeight(fontKey, tuning);
  ctx.font = `${numericWeight} ${fontSize}px ${fontFamily}`;

  const fillHex = extractFillHexFromTextColorPreset(colorKey);
  const strokeHex = strokeColorForFill(fillHex);
  const lineHeight = fontSize * lineMult;
  const mode = getEffectiveProgrammaticPlacementMode(tuning, frameIndex);
  const analysisSide = Math.max(256, Math.min(workW, workH));
  const subjectRaw = computeSubjectBoundingBoxFromContext(ctx, workW, workH, {
    maxAnalysisSide: analysisSide,
  });
  const subjectForAvoid =
    subjectRaw != null ? subjectAvoidanceRegion(subjectRaw, workW, workH, fontSize) : null;

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
      frameIndex,
      subjectRaw
    );
  } else {
    placementLabel = resolveProgrammaticPlacementLabel(frameIndex, tuning);
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
    subjectForAvoid != null && (mode === 'auto_avoid_subject' || mode === 'cycle');
  if (shouldNudgeForOverlap) {
    const { padX, padY } = textOverlayAvoidancePadPx(fontSize, strokeMult);
    const inset = frameInsetPx(workW, workH, marginRatio);
    const layoutAtAnchor: TextPlacementLayout = { ...layout, anchorX, anchorY };
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
      mode === 'cycle' ? preferredNudgeDirectionForPlacementLabel(placementLabel) : undefined;
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
