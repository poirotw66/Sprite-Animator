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

/** `gemini-3.1-flash-image` aligns 4×5 grids from prompt; template PNG is optional. */
export function modelSkipsGridTemplateAttachment(model: string): boolean {
  const normalized = model.replace(/-preview$/i, '');
  return normalized === 'gemini-3.1-flash-image';
}

/** User/config request after model capability gate (no template file for flash-image). */
export function resolveEffectiveGridTemplate(
  model: string,
  gridTemplate: GridTemplateRequest
): false | true | 'guided' {
  if (!gridTemplate) return false;
  if (modelSkipsGridTemplateAttachment(model)) return false;
  return gridTemplate === 'guided' ? 'guided' : true;
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
