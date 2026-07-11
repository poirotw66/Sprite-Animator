/**
 * Public types and defaults for LINE sticker programmatic text overlay.
 * Pure data with no logic dependencies — kept separate so UI/hook modules can
 * import the config shape without pulling in the heavy canvas rendering code.
 */

import type { ComposeLayoutPreset } from './lineStickerComposeLayout';

/** How to pick text anchor when compositing programmatically. */
export type ProgrammaticTextPlacementMode =
  | 'cycle'
  | 'bottom_center'
  | 'top_center'
  | 'middle_center'
  /** Pick a preset corner/edge from raster so caption avoids opaque subject bbox. */
  | 'auto_avoid_subject';

/** How to resolve canvas font-family for programmatic overlay. */
export type ProgrammaticFontFamilySource = 'preset' | 'custom';

/** How to resolve final caption font size from fontSizePercent. */
export type ProgrammaticFontSizeMode =
  /** Binary-search largest overlap-free size up to fontSizePercent cap (default). */
  | 'auto'
  /** Use fontSizePercent directly; placement still avoids subject when possible. */
  | 'fixed';

/** User-tunable overlay parameters (LINE sticker programmatic text mode). */
export interface ProgrammaticTextOverlayTuning {
  /** Font size as percent of min(frame width, height), e.g. 11 => 0.11 multiplier. */
  fontSizePercent: number;
  /** When `fixed`, fontSizePercent is the target size; when `auto`, it is only an upper cap. */
  fontSizeMode?: ProgrammaticFontSizeMode;
  /** Edge inset for text box, percent of min(frame width, height). */
  edgeMarginPercent: number;
  /** Line height as multiple of font size. */
  lineHeightMultiplier: number;
  /** Multiplier for auto stroke width. */
  strokeScale: number;
  placementMode: ProgrammaticTextPlacementMode;
  fontWeight: 400 | 500 | 600 | 700;
  /** Shift text anchor horizontally (% of frame width, negative = left). */
  offsetXPercent: number;
  /** Shift text anchor vertically (% of frame height, negative = up). */
  offsetYPercent: number;
  fontFamilySource: ProgrammaticFontFamilySource;
  /** When fontFamilySource is custom: CSS font-family list (e.g. "Noto Sans TC", sans-serif). */
  customFontFamily: string;
  /**
   * Optional per-frame placement mode. Index matches sticker frame; null/undefined = use placementMode.
   */
  placementModeOverrides?: (ProgrammaticTextPlacementMode | null)[];
}

/** Stroke width as a fraction of font size (before strokeMult; canvas lineWidth uses 2× this). */
export const PROGRAMMATIC_TEXT_STROKE_WIDTH_RATIO = 0.065;

export function programmaticTextStrokeWidthPx(fontSize: number, strokeMult: number): number {
  return Math.max(1.2, fontSize * PROGRAMMATIC_TEXT_STROKE_WIDTH_RATIO * strokeMult);
}

export const DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING: ProgrammaticTextOverlayTuning = {
  fontSizePercent: 11,
  fontSizeMode: 'auto',
  edgeMarginPercent: 6,
  lineHeightMultiplier: 1.25,
  strokeScale: 1,
  /** Aligns with per-cell Reserved caption band in the generation prompt. */
  placementMode: 'auto_avoid_subject',
  fontWeight: 700,
  offsetXPercent: 0,
  offsetYPercent: 0,
  fontFamilySource: 'preset',
  customFontFamily: '"Noto Sans TC", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
};

/** Merge job/UI partial tuning onto defaults. */
export function mergeProgrammaticTextTuning(
  partial?: Partial<ProgrammaticTextOverlayTuning>
): ProgrammaticTextOverlayTuning {
  if (!partial) {
    return { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING };
  }
  return {
    ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
    ...partial,
    placementModeOverrides: partial.placementModeOverrides
      ? [...partial.placementModeOverrides]
      : DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING.placementModeOverrides,
  };
}

/** Canvas-compose layout: disjoint caption/subject slots on a fixed work canvas. */
export interface ProgrammaticComposeConfig {
  enabled: boolean;
  layout?: ComposeLayoutPreset;
  workCanvas?: { width: number; height: number };
  subjectTrim?: 'none' | 'content';
  /** Extra scale for subject inside its slot (1 = contain max; default 1.12). */
  subjectScale?: number;
  /** Letter spacing between caption glyphs, in em of the caption font size (default 0.08). */
  captionLetterSpacingEm?: number;
  /** When true (default), nudge font/spacing by phrase length before layout. */
  phraseLengthAdaptive?: boolean;
  /** Margin ratio when trimAfterCompose is true (default 0.06). */
  trimMarginRatio?: number;
  trimAfterCompose?: boolean;
  tuning?: Partial<ProgrammaticTextOverlayTuning>;
}

export const DEFAULT_PROGRAMMATIC_COMPOSE_CONFIG: ProgrammaticComposeConfig = {
  enabled: false,
  layout: 'generation_aligned',
  subjectTrim: 'none',
  subjectScale: 1.12,
  captionLetterSpacingEm: 0.16,
  phraseLengthAdaptive: true,
  trimMarginRatio: 0.06,
  trimAfterCompose: true,
  tuning: {
    fontSizePercent: 20,
    fontSizeMode: 'fixed',
  },
};

/** Adjust caption size/spacing from phrase length so short lines breathe and long lines fit. */
export function resolvePhraseAdaptiveCaptionTuning(
  phrase: string,
  baseFontSizePercent: number,
  baseLetterSpacingEm: number
): { fontSizePercent: number; letterSpacingEm: number } {
  const len = Array.from(phrase.trim()).length;
  if (len <= 3) {
    return {
      fontSizePercent: Math.min(24, baseFontSizePercent + 2),
      letterSpacingEm: Math.min(0.4, baseLetterSpacingEm + 0.02),
    };
  }
  if (len >= 5) {
    return {
      fontSizePercent: Math.max(16, baseFontSizePercent - 1),
      letterSpacingEm: Math.max(0, baseLetterSpacingEm - 0.02),
    };
  }
  return { fontSizePercent: baseFontSizePercent, letterSpacingEm: baseLetterSpacingEm };
}

export function mergeProgrammaticComposeConfig(
  partial?: Partial<ProgrammaticComposeConfig>
): ProgrammaticComposeConfig {
  if (!partial) {
    return { ...DEFAULT_PROGRAMMATIC_COMPOSE_CONFIG };
  }
  return {
    ...DEFAULT_PROGRAMMATIC_COMPOSE_CONFIG,
    ...partial,
    workCanvas: partial.workCanvas ? { ...partial.workCanvas } : DEFAULT_PROGRAMMATIC_COMPOSE_CONFIG.workCanvas,
    tuning: partial.tuning
      ? { ...DEFAULT_PROGRAMMATIC_COMPOSE_CONFIG.tuning, ...partial.tuning }
      : DEFAULT_PROGRAMMATIC_COMPOSE_CONFIG.tuning,
  };
}
