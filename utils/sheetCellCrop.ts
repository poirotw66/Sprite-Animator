/**
 * Per-cell crop rectangles for sticker sheets: per-column row seams plus
 * connected-component grouping so overflow text/limbs in gutters stay attached.
 *
 * Used by the legacy `detect` slice mode only. Guided/template slicing lives in
 * utils/sheetComponentSlicer.ts (ownership masking).
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';

export interface CellCropRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ComputeCellCropOptions {
  /** Horizontal search expansion as a fraction of column width (default 0.14). */
  gutterRatio?: number;
  /** Min fraction of component pixels inside the column to claim it (default 0.28). */
  minColumnMassRatio?: number;
  /** Padding around merged component bounds in px (default 3). */
  paddingPx?: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

interface Component {
  pixels: PixelPoint[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  massInColumn: number;
  centroidX: number;
}

function fallbackCellRect(colX0: number, colX1: number, y0: number, y1: number): CellCropRect {
  return { x0: colX0, y0, x1: colX1, y1 };
}

function findComponents(
  data: Uint8ClampedArray,
  sheetWidth: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Component[] {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return [];

  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const components = new Map<number, Component>();

  const index = (x: number, y: number) => (y - y0) * w + (x - x0);
  const isForeground = (x: number, y: number) => {
    const offset = (y * sheetWidth + x) * 4;
    return !isSliceBackgroundPixel(
      data[offset]!,
      data[offset + 1]!,
      data[offset + 2]!,
      data[offset + 3]!
    );
  };

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const flat = index(x, y);
      if (labels[flat]! !== 0 || !isForeground(x, y)) continue;

      const label = nextLabel++;
      const stack: Array<[number, number]> = [[x, y]];
      labels[flat] = label;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      const pixels: PixelPoint[] = [];

      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        pixels.push({ x: cx, y: cy });
        sumX += cx;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        if (cx > x0 && labels[index(cx - 1, cy)]! === 0 && isForeground(cx - 1, cy)) {
          labels[index(cx - 1, cy)] = label;
          stack.push([cx - 1, cy]);
        }
        if (cx + 1 < x1 && labels[index(cx + 1, cy)]! === 0 && isForeground(cx + 1, cy)) {
          labels[index(cx + 1, cy)] = label;
          stack.push([cx + 1, cy]);
        }
        if (cy > y0 && labels[index(cx, cy - 1)]! === 0 && isForeground(cx, cy - 1)) {
          labels[index(cx, cy - 1)] = label;
          stack.push([cx, cy - 1]);
        }
        if (cy + 1 < y1 && labels[index(cx, cy + 1)]! === 0 && isForeground(cx, cy + 1)) {
          labels[index(cx, cy + 1)] = label;
          stack.push([cx, cy + 1]);
        }
      }

      components.set(label, {
        pixels,
        minX,
        maxX,
        minY,
        maxY,
        massInColumn: 0,
        centroidX: sumX / pixels.length,
      });
    }
  }

  return [...components.values()];
}

/**
 * Build a crop rectangle for one grid cell using per-column row bounds and
 * connected components that belong to this column.
 */
export function computeCellCropRect(
  data: Uint8ClampedArray,
  sheetWidth: number,
  sheetHeight: number,
  cols: number,
  row: number,
  col: number,
  xBounds: number[],
  yBoundsPerColumn: number[][],
  options: ComputeCellCropOptions = {}
): CellCropRect {
  const gutterRatio = options.gutterRatio ?? 0.14;
  const minColumnMassRatio = options.minColumnMassRatio ?? 0.28;
  const paddingPx = options.paddingPx ?? 3;

  const colX0 = xBounds[col]!;
  const colX1 = xBounds[col + 1]!;
  const colY = yBoundsPerColumn[col];
  if (!colY) {
    return fallbackCellRect(colX0, colX1, 0, sheetHeight);
  }

  const y0 = colY[row]!;
  const y1 = colY[row + 1]!;
  if (y1 <= y0) {
    return fallbackCellRect(colX0, colX1, y0, y1);
  }

  const cellW = Math.max(1, colX1 - colX0);
  const gutter = Math.max(8, Math.floor(cellW * gutterRatio));
  const searchX0 = Math.max(xBounds[0]!, colX0 - gutter);
  const searchX1 = Math.min(xBounds[cols]!, colX1 + gutter);

  const components = findComponents(data, sheetWidth, searchX0, y0, searchX1, y1);
  if (components.length === 0) {
    return fallbackCellRect(colX0, colX1, y0, y1);
  }

  const selected: Component[] = [];
  for (const component of components) {
    let massInColumn = 0;
    for (const pixel of component.pixels) {
      if (pixel.x >= colX0 && pixel.x < colX1) massInColumn++;
    }
    component.massInColumn = massInColumn;
    const massRatio = massInColumn / component.pixels.length;
    const centroidInColumn = component.centroidX >= colX0 && component.centroidX < colX1;
    if (massRatio >= minColumnMassRatio || centroidInColumn) {
      selected.push(component);
    }
  }

  if (selected.length === 0) {
    const centerX = (colX0 + colX1) / 2;
    const centerY = (y0 + y1) / 2;
    let best: Component | undefined;
    let bestDist = Infinity;
    for (const component of components) {
      const cx = (component.minX + component.maxX) / 2;
      const cy = (component.minY + component.maxY) / 2;
      const dist = (cx - centerX) ** 2 + (cy - centerY) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = component;
      }
    }
    if (best) selected.push(best);
  }

  if (selected.length === 0) {
    return fallbackCellRect(colX0, colX1, y0, y1);
  }

  const primary = selected.reduce((best, current) =>
    current.massInColumn > best.massInColumn ? current : best
  );
  const attachGap = Math.max(20, gutter);
  for (const component of components) {
    if (selected.includes(component)) continue;
    const verticalOverlap =
      component.maxY >= primary.minY - attachGap && component.minY <= primary.maxY + attachGap;
    const horizontalNear =
      component.minX <= primary.maxX + attachGap && component.maxX >= primary.minX - attachGap;
    if (verticalOverlap && horizontalNear) {
      selected.push(component);
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const component of selected) {
    minX = Math.min(minX, component.minX);
    minY = Math.min(minY, component.minY);
    maxX = Math.max(maxX, component.maxX);
    maxY = Math.max(maxY, component.maxY);
  }

  const maxCropX = Math.min(xBounds[cols]!, colX1 + gutter * 2);

  return {
    x0: Math.max(searchX0, minX - paddingPx),
    y0: Math.max(y0, minY - paddingPx),
    x1: Math.min(maxCropX, maxX + 1 + paddingPx),
    y1: Math.min(y1, maxY + 1 + paddingPx),
  };
}
