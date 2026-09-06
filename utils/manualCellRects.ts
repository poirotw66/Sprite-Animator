/**
 * Helpers for manual rectangle marquee slice mode (`sliceMode: 'rects'`).
 */
import { cellRectsFromBounds } from './manualGridBounds';
import type { SliceSettings } from './spriteSlicing';

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_CELL_RECT_SIZE = 8;

/** Normalize a drag from (x0,y0) to (x1,y1) into a positive-size rect clamped to the sheet. */
export function normalizeDragRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sheetWidth: number,
  sheetHeight: number,
  minSize = MIN_CELL_RECT_SIZE
): CellRect | null {
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  const rawW = right - left;
  const rawH = bottom - top;
  if (rawW < minSize || rawH < minSize) return null;
  return clampCellRect(
    {
      x: left,
      y: top,
      width: rawW,
      height: rawH,
    },
    sheetWidth,
    sheetHeight,
    minSize
  );
}

/** Clamp rect inside the sheet and enforce minimum size when possible. */
export function clampCellRect(
  rect: CellRect,
  sheetWidth: number,
  sheetHeight: number,
  minSize = MIN_CELL_RECT_SIZE
): CellRect {
  const maxW = Math.max(1, sheetWidth);
  const maxH = Math.max(1, sheetHeight);
  let width = Math.max(minSize, Math.round(rect.width));
  let height = Math.max(minSize, Math.round(rect.height));
  width = Math.min(width, maxW);
  height = Math.min(height, maxH);
  let x = Math.round(rect.x);
  let y = Math.round(rect.y);
  x = Math.max(0, Math.min(x, maxW - width));
  y = Math.max(0, Math.min(y, maxH - height));
  return { x, y, width, height };
}

export function pointInRect(px: number, py: number, rect: CellRect): boolean {
  return (
    px >= rect.x &&
    py >= rect.y &&
    px <= rect.x + rect.width &&
    py <= rect.y + rect.height
  );
}

/** Topmost (last) rect containing the point, or -1. */
export function hitTestCellRect(rects: CellRect[], px: number, py: number): number {
  for (let i = rects.length - 1; i >= 0; i--) {
    if (pointInRect(px, py, rects[i]!)) return i;
  }
  return -1;
}

export type ResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

const HANDLE_HIT_PX = 10;

export function hitTestResizeHandle(
  rect: CellRect,
  px: number,
  py: number,
  threshold = HANDLE_HIT_PX
): ResizeHandle | null {
  const { x, y, width, height } = rect;
  const right = x + width;
  const bottom = y + height;
  const nearL = Math.abs(px - x) <= threshold;
  const nearR = Math.abs(px - right) <= threshold;
  const nearT = Math.abs(py - y) <= threshold;
  const nearB = Math.abs(py - bottom) <= threshold;
  const inX = px >= x - threshold && px <= right + threshold;
  const inY = py >= y - threshold && py <= bottom + threshold;

  if (nearT && nearL) return 'nw';
  if (nearT && nearR) return 'ne';
  if (nearB && nearL) return 'sw';
  if (nearB && nearR) return 'se';
  if (nearT && inX) return 'n';
  if (nearB && inX) return 's';
  if (nearL && inY) return 'w';
  if (nearR && inY) return 'e';
  return null;
}

export function applyResizeHandle(
  rect: CellRect,
  handle: ResizeHandle,
  px: number,
  py: number,
  sheetWidth: number,
  sheetHeight: number
): CellRect {
  let { x, y, width, height } = rect;
  const right = x + width;
  const bottom = y + height;

  if (handle.includes('n')) {
    y = py;
    height = bottom - py;
  }
  if (handle.includes('s')) {
    height = py - y;
  }
  if (handle.includes('w')) {
    x = px;
    width = right - px;
  }
  if (handle.includes('e')) {
    width = px - x;
  }

  if (width < 0) {
    x += width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y += height;
    height = Math.abs(height);
  }

  return clampCellRect({ x, y, width, height }, sheetWidth, sheetHeight);
}

export function moveCellRect(
  rect: CellRect,
  dx: number,
  dy: number,
  sheetWidth: number,
  sheetHeight: number
): CellRect {
  return clampCellRect(
    { ...rect, x: rect.x + dx, y: rect.y + dy },
    sheetWidth,
    sheetHeight
  );
}

export function cloneCellRects(rects: CellRect[]): CellRect[] {
  return rects.map((r) => ({ ...r }));
}

export function cellRectsEqual(a: CellRect[], b: CellRect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i]!;
    const rb = b[i]!;
    if (
      ra.x !== rb.x ||
      ra.y !== rb.y ||
      ra.width !== rb.width ||
      ra.height !== rb.height
    ) {
      return false;
    }
  }
  return true;
}

/** Enter rectangle marquee mode with an empty selection list. */
export function enterRectsSliceMode(settings: SliceSettings): SliceSettings {
  return {
    ...settings,
    sliceMode: 'rects',
    inferredCellRects: settings.sliceMode === 'rects' ? settings.inferredCellRects ?? [] : [],
    manualXBounds: undefined,
    manualYBounds: undefined,
  };
}

/** Clear all marquee rectangles while staying in rects mode. */
export function clearRectsSliceMode(settings: SliceSettings): SliceSettings {
  return {
    ...settings,
    sliceMode: 'rects',
    inferredCellRects: [],
    cols: 1,
    rows: 1,
    manualXBounds: undefined,
    manualYBounds: undefined,
  };
}

/**
 * Resolve the sheet crop rect for one frame index, honoring rects / inferred / manual modes.
 */
export function resolveCellRectForFrame(
  settings: SliceSettings,
  sheetWidth: number,
  sheetHeight: number,
  frameIndex: number,
  getEqualGridRect: () => CellRect | null
): CellRect | null {
  if (
    (settings.sliceMode === 'rects' || settings.sliceMode === 'inferred') &&
    settings.inferredCellRects?.length
  ) {
    return settings.inferredCellRects[frameIndex] ?? null;
  }
  if (
    settings.sliceMode === 'manual' &&
    settings.manualXBounds &&
    settings.manualYBounds
  ) {
    const rects = cellRectsFromBounds(settings.manualXBounds, settings.manualYBounds);
    return rects[frameIndex] ?? null;
  }
  void sheetWidth;
  void sheetHeight;
  return getEqualGridRect();
}
