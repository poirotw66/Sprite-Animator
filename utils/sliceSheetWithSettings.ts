/**
 * Dispatch equal / inferred / ownership sheet slicing from SliceSettings.
 */

import type { ChromaKeyColorType } from '../types';
import { cellRectsFromBounds } from './manualGridBounds';
import { sliceSpriteSheet } from './sliceSpriteSheet';
import { sliceSpriteSheetByCellRects } from './sliceByCellRects';
import { sliceSpriteSheetByOwnership } from './sliceSpriteSheetByOwnership';
import { getEffectivePadding, type FrameOverride, type SliceSettings } from './spriteSlicing';

export interface DispatchSheetSliceOptions {
  frameOverrides?: FrameOverride[];
  chromaKeyColor?: ChromaKeyColorType;
  cellInsetRatio?: number;
  threshold?: number;
}

/** Pick slicer from sliceMode and run against a processed (or raw) sheet image. */
export async function sliceSheetWithSettings(
  source: string,
  settings: SliceSettings,
  options: DispatchSheetSliceOptions = {}
): Promise<string[]> {
  const {
    frameOverrides,
    chromaKeyColor = 'green',
    cellInsetRatio = 0,
    threshold = 230,
  } = options;

  if (settings.sliceMode === 'inferred' && settings.inferredCellRects?.length) {
    return sliceSpriteSheetByCellRects(source, settings.inferredCellRects);
  }

  if (
    settings.sliceMode === 'manual' &&
    settings.manualXBounds &&
    settings.manualYBounds &&
    settings.manualXBounds.length >= 2 &&
    settings.manualYBounds.length >= 2
  ) {
    const rects = cellRectsFromBounds(settings.manualXBounds, settings.manualYBounds);
    return sliceSpriteSheetByCellRects(source, rects);
  }

  const padding = getEffectivePadding(settings);
  const args = [
    source,
    settings.cols,
    settings.rows,
    settings.paddingX,
    settings.paddingY,
    settings.shiftX,
    settings.shiftY,
    false,
    threshold,
    frameOverrides,
    chromaKeyColor,
    padding,
    cellInsetRatio,
  ] as const;

  if (settings.sliceMode === 'ownership') {
    return sliceSpriteSheetByOwnership(...args);
  }

  return sliceSpriteSheet(...args);
}
