/**
 * Slot geometry for canvas-compose LINE sticker layout.
 * Caption and subject regions are disjoint pixel rectangles on a fixed work canvas.
 * Caption slots are sized from the target font so the configured fontSizePercent
 * renders at full size instead of being shrunk to fit a fixed band.
 */

import { LINE_STICKER_UPLOAD } from './lineStickerUploadSpec';
import {
  rectangleIntersectionArea,
  type PixelRect,
} from './lineStickerTextOverlayGeometry';

export const WORK_CANVAS_WIDTH = LINE_STICKER_UPLOAD.stickerMaxWidth;
export const WORK_CANVAS_HEIGHT = LINE_STICKER_UPLOAD.stickerMaxHeight;

export const SIDE_STRIP_WIDTH_RATIO = 0.22;
/** Fallback caption band height when no caption sizing is provided. */
export const COMPOSE_CAPTION_BAND_HEIGHT_RATIO = 0.22;

export type ComposeLayoutPreset =
  | 'top_caption_bottom_subject'
  | 'bottom_caption_top_subject'
  | 'side_caption_left_subject_right'
  | 'side_caption_right_subject_left'
  | 'corner_top_left_subject_bottom_right'
  | 'corner_top_right_subject_bottom_left'
  | 'corner_bottom_left_subject_top'
  | 'corner_bottom_right_subject_top'
  | 'generation_aligned';

export type ComposeSubjectAnchor =
  | 'bottom_center'
  | 'top_center'
  | 'center'
  | 'center_right'
  | 'center_left';

export type ComposeCaptionAlign = 'left' | 'center' | 'right';
export type ComposeCaptionOrientation = 'horizontal' | 'vertical';

/** Target caption font metrics used to size caption slots. */
export interface ComposeCaptionSizing {
  fontSizePx: number;
  lineHeightMultiplier: number;
}

export interface ComposeSlots {
  captionSlot: PixelRect;
  subjectSlot: PixelRect;
  subjectAnchor: ComposeSubjectAnchor;
  captionAlign: ComposeCaptionAlign;
  captionOrientation: ComposeCaptionOrientation;
  /** Optional per-preset subject scale inside its slot (defaults to compose config). */
  subjectScale?: number;
}

function marginPx(width: number, height: number, marginRatio: number): number {
  return Math.max(2, Math.round(Math.min(width, height) * marginRatio));
}

/** Horizontal caption band height: one full-size text line plus stroke padding. */
function horizontalBandHeight(innerH: number, sizing?: ComposeCaptionSizing): number {
  if (!sizing) {
    return Math.round(innerH * COMPOSE_CAPTION_BAND_HEIGHT_RATIO);
  }
  const lineMult = Math.max(1.02, Math.min(1.8, sizing.lineHeightMultiplier));
  const needed = Math.ceil(sizing.fontSizePx * lineMult * 1.04);
  return Math.min(Math.round(innerH * 0.42), Math.max(Math.round(innerH * 0.18), needed));
}

/** Vertical caption strip width: one full-size glyph column plus stroke padding. */
function verticalStripWidth(innerW: number, sizing?: ComposeCaptionSizing): number {
  if (!sizing) {
    return Math.round(innerW * SIDE_STRIP_WIDTH_RATIO);
  }
  const needed = Math.ceil(sizing.fontSizePx * 1.3);
  return Math.min(Math.round(innerW * 0.34), Math.max(Math.round(innerW * 0.18), needed));
}

function snapPixelRect(rect: PixelRect): PixelRect {
  const minX = Math.round(rect.minX);
  const minY = Math.round(rect.minY);
  const maxX = Math.round(rect.maxX);
  const maxY = Math.round(rect.maxY);
  return {
    minX,
    minY,
    maxX: Math.max(minX + 1, maxX),
    maxY: Math.max(minY + 1, maxY),
  };
}

function snapSlots(slots: ComposeSlots): ComposeSlots {
  return {
    ...slots,
    captionSlot: snapPixelRect(slots.captionSlot),
    subjectSlot: snapPixelRect(slots.subjectSlot),
  };
}

/** Map generation reserved-band label to a concrete compose preset. */
export function mapBandLabelToComposePreset(label: string): Exclude<ComposeLayoutPreset, 'generation_aligned'> {
  const lower = label.toLowerCase();
  if (lower.includes('beside head (left)')) {
    return 'side_caption_left_subject_right';
  }
  if (lower.includes('beside head (right)')) {
    return 'side_caption_right_subject_left';
  }
  if (lower.includes('diagonal')) {
    return 'corner_bottom_right_subject_top';
  }
  if (lower.includes('bottom left')) {
    return 'corner_bottom_left_subject_top';
  }
  if (lower.includes('bottom right')) {
    return 'corner_bottom_right_subject_top';
  }
  if (lower.includes('bottom')) {
    return 'bottom_caption_top_subject';
  }
  if (lower.includes('top left')) {
    return 'corner_top_left_subject_bottom_right';
  }
  if (lower.includes('top right')) {
    return 'corner_top_right_subject_bottom_left';
  }
  if (lower.includes('top')) {
    return 'top_caption_bottom_subject';
  }
  return 'top_caption_bottom_subject';
}

export function resolveEffectiveComposePreset(
  layout: ComposeLayoutPreset,
  frameIndex: number,
  bandLabelForFrame: (index: number) => string
): Exclude<ComposeLayoutPreset, 'generation_aligned'> {
  if (layout !== 'generation_aligned') {
    return layout;
  }
  return mapBandLabelToComposePreset(bandLabelForFrame(frameIndex));
}

export function resolveComposeSlots(
  preset: Exclude<ComposeLayoutPreset, 'generation_aligned'>,
  width: number,
  height: number,
  marginRatio: number,
  captionSizing?: ComposeCaptionSizing
): ComposeSlots {
  const margin = marginPx(width, height, marginRatio);
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;
  const bandH = horizontalBandHeight(innerH, captionSizing);
  const stripW = verticalStripWidth(innerW, captionSizing);

  const topBand: PixelRect = {
    minX: margin,
    minY: margin,
    maxX: width - margin,
    maxY: margin + bandH,
  };
  const bottomBand: PixelRect = {
    minX: margin,
    minY: height - margin - bandH,
    maxX: width - margin,
    maxY: height - margin,
  };
  const subjectBelowBand: PixelRect = {
    minX: margin,
    minY: margin + bandH,
    maxX: width - margin,
    maxY: height - margin,
  };
  const subjectAboveBand: PixelRect = {
    minX: margin,
    minY: margin,
    maxX: width - margin,
    maxY: height - margin - bandH,
  };

  switch (preset) {
    case 'top_caption_bottom_subject':
      return snapSlots({
        captionSlot: topBand,
        subjectSlot: subjectBelowBand,
        subjectAnchor: 'bottom_center',
        captionAlign: 'center',
        captionOrientation: 'horizontal',
        subjectScale: 1.22,
      });
    case 'bottom_caption_top_subject':
      return snapSlots({
        captionSlot: bottomBand,
        subjectSlot: subjectAboveBand,
        subjectAnchor: 'bottom_center',
        captionAlign: 'center',
        captionOrientation: 'horizontal',
        subjectScale: 1.28,
      });
    case 'corner_top_left_subject_bottom_right':
      return snapSlots({
        captionSlot: topBand,
        subjectSlot: subjectBelowBand,
        subjectAnchor: 'bottom_center',
        captionAlign: 'left',
        captionOrientation: 'horizontal',
        subjectScale: 1.22,
      });
    case 'corner_top_right_subject_bottom_left':
      return snapSlots({
        captionSlot: topBand,
        subjectSlot: subjectBelowBand,
        subjectAnchor: 'bottom_center',
        captionAlign: 'right',
        captionOrientation: 'horizontal',
        subjectScale: 1.22,
      });
    case 'corner_bottom_left_subject_top':
      return snapSlots({
        captionSlot: bottomBand,
        subjectSlot: subjectAboveBand,
        subjectAnchor: 'bottom_center',
        captionAlign: 'left',
        captionOrientation: 'horizontal',
        subjectScale: 1.28,
      });
    case 'corner_bottom_right_subject_top':
      return snapSlots({
        captionSlot: bottomBand,
        subjectSlot: subjectAboveBand,
        subjectAnchor: 'bottom_center',
        captionAlign: 'right',
        captionOrientation: 'horizontal',
        subjectScale: 1.28,
      });
    case 'side_caption_left_subject_right':
      return snapSlots({
        captionSlot: {
          minX: margin,
          minY: margin,
          maxX: margin + stripW,
          maxY: height - margin,
        },
        subjectSlot: {
          minX: margin + stripW,
          minY: margin,
          maxX: width - margin,
          maxY: height - margin,
        },
        subjectAnchor: 'center_right',
        captionAlign: 'center',
        captionOrientation: 'vertical',
        subjectScale: 1.22,
      });
    case 'side_caption_right_subject_left':
      return snapSlots({
        captionSlot: {
          minX: width - margin - stripW,
          minY: margin,
          maxX: width - margin,
          maxY: height - margin,
        },
        subjectSlot: {
          minX: margin,
          minY: margin,
          maxX: width - margin - stripW,
          maxY: height - margin,
        },
        subjectAnchor: 'center_left',
        captionAlign: 'center',
        captionOrientation: 'vertical',
        subjectScale: 1.22,
      });
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function slotsAreDisjoint(slots: ComposeSlots): boolean {
  return rectangleIntersectionArea(slots.captionSlot, slots.subjectSlot) <= 0;
}

export function captionFontSizePx(
  canvasWidth: number,
  canvasHeight: number,
  fontSizePercent: number
): number {
  const ratio = Math.max(0.04, Math.min(0.3, fontSizePercent / 100));
  return Math.max(10, Math.round(Math.min(canvasWidth, canvasHeight) * ratio));
}

export function slotWidth(slot: PixelRect): number {
  return slot.maxX - slot.minX;
}

export function slotHeight(slot: PixelRect): number {
  return slot.maxY - slot.minY;
}

/** Scale + offset to fit subject inside slot using contain. */
export function fitSubjectPlacement(
  subjectWidth: number,
  subjectHeight: number,
  slot: PixelRect,
  anchor: ComposeSubjectAnchor,
  subjectScale = 1
): { offsetX: number; offsetY: number; drawWidth: number; drawHeight: number } {
  const slotX = Math.round(slot.minX);
  const slotY = Math.round(slot.minY);
  const slotW = Math.max(1, Math.round(slot.maxX) - slotX);
  const slotH = Math.max(1, Math.round(slot.maxY) - slotY);
  const scale =
    Math.min(slotW / subjectWidth, slotH / subjectHeight) *
    Math.max(1, Math.min(1.35, subjectScale)); // ponytail: ceiling 1.35; raise compose.subjectScale to grow subject
  let drawWidth = Math.max(1, Math.round(subjectWidth * scale));
  let drawHeight = Math.max(1, Math.round(subjectHeight * scale));
  drawWidth = Math.min(drawWidth, slotW);
  drawHeight = Math.min(drawHeight, slotH);

  let offsetX = slotX + Math.floor((slotW - drawWidth) / 2);
  let offsetY = slotY + Math.floor((slotH - drawHeight) / 2);

  if (anchor === 'bottom_center') {
    offsetY = slotY + slotH - drawHeight;
  } else if (anchor === 'top_center') {
    offsetY = slotY;
  } else if (anchor === 'center_right') {
    offsetX = slotX + slotW - drawWidth;
  } else if (anchor === 'center_left') {
    offsetX = slotX;
  }

  return { offsetX, offsetY, drawWidth, drawHeight };
}
