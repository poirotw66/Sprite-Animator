/**
 * Shared sprite slicing types and helpers.
 * Kept separate to reduce coupling with the heavy image processing module.
 */

export interface SliceSettings {
  cols: number;
  rows: number;
  paddingX: number;
  paddingY: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  shiftX: number;
  shiftY: number;
  autoOptimized?: {
    paddingX?: boolean;
    paddingY?: boolean;
    shiftX?: boolean;
    shiftY?: boolean;
  };
  sliceMode?: 'equal' | 'inferred';
  inferredCellRects?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface FrameOverride {
  offsetX?: number;
  offsetY?: number;
  scale?: number;
}

export interface PaddingFour {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function getEffectivePadding(settings: SliceSettings): PaddingFour {
  return {
    left: settings.paddingLeft ?? settings.paddingX,
    right: settings.paddingRight ?? settings.paddingX,
    top: settings.paddingTop ?? settings.paddingY,
    bottom: settings.paddingBottom ?? settings.paddingY,
  };
}
