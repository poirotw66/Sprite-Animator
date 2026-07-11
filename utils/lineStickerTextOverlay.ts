/**
 * Browser-only: draw LINE sticker phrase text onto a sliced frame (data URL PNG).
 * Used when textRendering is programmatic so the image model omits text.
 *
 * This module is the entry point: it owns font/color resolution and the canvas
 * rendering pipeline, and re-exports the geometry + subject-detection helpers
 * (split into sibling modules) so existing importers of './lineStickerTextOverlay'
 * keep working unchanged.
 */

import {
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  getReservedCaptionBandLabelForFrame,
} from './lineStickerPrompt';

import type {
  ProgrammaticTextPlacementMode,
  ProgrammaticFontFamilySource,
  ProgrammaticTextOverlayTuning,
} from './lineStickerTextOverlayTypes';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  programmaticTextStrokeWidthPx,
} from './lineStickerTextOverlayTypes';

import {
  layoutFromPlacementLabel,
  textOverlayAvoidancePadPx,
  estimateTextBlockBoxFromMeasuredLines,
  rectangleIntersectionArea,
  inflatePixelRect,
  correctionToFitTextBoxInFrame,
  rectangleMinSeparation,
  estimateTextBlockBox,
} from './lineStickerTextOverlayGeometry';
import type {
  TextPlacementLayout,
  LayoutFromPlacementOptions,
  PixelRect,
} from './lineStickerTextOverlayGeometry';

import { computeAutoCaptionLayout, frameInsetPx } from './lineStickerTextOverlaySubject';

// Re-export so existing importers of './lineStickerTextOverlay' keep working.
export type {
  ProgrammaticTextPlacementMode,
  ProgrammaticFontFamilySource,
  ProgrammaticTextOverlayTuning,
};
export { DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING };
export {
  layoutFromPlacementLabel,
  textOverlayAvoidancePadPx,
  estimateTextBlockBoxFromMeasuredLines,
  rectangleIntersectionArea,
  inflatePixelRect,
  correctionToFitTextBoxInFrame,
  rectangleMinSeparation,
  estimateTextBlockBox,
};
export type { TextPlacementLayout, LayoutFromPlacementOptions, PixelRect };
export { computeAutoCaptionLayout, frameInsetPx };

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
    kidDoodle:
      '"Comic Sans MS", "Marker Felt", "Chalkboard SE", "Bradley Hand ITC", "Microsoft JhengHei", "PingFang TC", sans-serif',
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

        const fontFamily = resolveProgrammaticFontFamilyCss(options.fontKey, tuning);
        const numericWeight = resolveCanvasFontNumericWeight(options.fontKey, tuning);
        const fillHex = extractFillHexFromTextColorPreset(options.colorKey);
        const strokeHex = strokeColorForFill(fillHex);
        const mode = getEffectiveProgrammaticPlacementMode(tuning, options.frameIndex);
        const preferredLabel =
          mode === 'auto_avoid_subject' || mode === 'cycle'
            ? getReservedCaptionBandLabelForFrame(options.frameIndex)
            : resolveProgrammaticPlacementLabel(options.frameIndex, tuning);

        const layout = computeAutoCaptionLayout(ctx, {
          width: workW,
          height: workH,
          text: trimmed,
          preferredLabel,
          marginRatio,
          lineHeightMultiplier: lineMult,
          strokeScale: strokeMult,
          baseFontSizePx: Math.max(10, Math.round(Math.min(workW, workH) * sizeRatio)),
          fontSizeMode: tuning.fontSizeMode ?? 'auto',
          applyFont: (px) => {
            ctx.font = `${numericWeight} ${px}px ${fontFamily}`;
          },
        });

        const offsetX = (workW * tuning.offsetXPercent) / 100;
        const offsetY = (workH * tuning.offsetYPercent) / 100;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        const strokeW = programmaticTextStrokeWidthPx(layout.fontSize, strokeMult);
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
