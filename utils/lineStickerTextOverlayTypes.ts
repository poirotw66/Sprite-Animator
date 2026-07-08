/**
 * Public types and defaults for LINE sticker programmatic text overlay.
 * Pure data with no logic dependencies — kept separate so UI/hook modules can
 * import the config shape without pulling in the heavy canvas rendering code.
 */

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

/** User-tunable overlay parameters (LINE sticker programmatic text mode). */
export interface ProgrammaticTextOverlayTuning {
  /** Font size as percent of min(frame width, height), e.g. 11 => 0.11 multiplier. */
  fontSizePercent: number;
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

export const DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING: ProgrammaticTextOverlayTuning = {
  fontSizePercent: 11,
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
