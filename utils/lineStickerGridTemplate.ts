/**
 * Whether to attach a chroma/grid template image to Gemini for LINE sticker sheets.
 */

import { detectSheetGridBoundaries } from './sheetBoundaryDetection';

export type GridTemplateRequest = boolean | 'guided' | undefined;

export interface SliceTemplateBounds {
  xBounds: number[];
  yBounds: number[];
  source: 'guided-template' | 'detected';
}

/** Solid chroma canvas is optional for flash-image; guided layout ref is still attached. */
export function modelSkipsSolidGridTemplate(model: string): boolean {
  const normalized = model.replace(/-preview$/i, '');
  return normalized === 'gemini-3.1-flash-image';
}

/** @deprecated Use modelSkipsSolidGridTemplate — name kept for callers that mean solid-only skip. */
export function modelSkipsGridTemplateAttachment(model: string): boolean {
  return modelSkipsSolidGridTemplate(model);
}

/** User/config request after model capability gate. */
export function resolveEffectiveGridTemplate(
  model: string,
  gridTemplate: GridTemplateRequest
): false | true | 'guided' {
  if (!gridTemplate) return false;
  if (gridTemplate === 'guided') return 'guided';
  if (modelSkipsSolidGridTemplate(model)) return false;
  return true;
}

/** Fixed guided template bounds, or seam-detected bounds when no template was attached. */
export function resolveSliceTemplateBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number,
  sheetTemplate: { xBounds: number[]; yBounds: number[] } | null
): SliceTemplateBounds {
  if (sheetTemplate) {
    return {
      xBounds: sheetTemplate.xBounds,
      yBounds: sheetTemplate.yBounds,
      source: 'guided-template',
    };
  }
  const detected = detectSheetGridBoundaries(data, width, height, cols, rows);
  return {
    xBounds: detected.xBounds,
    yBounds: detected.yBounds,
    source: 'detected',
  };
}
