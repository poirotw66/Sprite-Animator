/**
 * Ownership-based sprite sheet slicing.
 *
 * Instead of guessing a crop rectangle per cell and then patching bleed artifacts,
 * this labels connected foreground components once over the whole sheet, assigns
 * each component to the grid cell holding the majority of its pixels, and extracts
 * every cell with foreign components masked out. Neighbor bleed becomes impossible
 * by construction, and cells keep their full empty space (needed later for caption
 * placement) instead of being cropped tight to the art.
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';
import { clearSmallOpaqueIslands } from './frameEdgeCleanup';

export interface RgbaFrameBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface OwnershipSliceOptions {
  /** Components smaller than this many pixels are dropped as noise. Default 12. */
  minComponentArea?: number;
  /** Extra pixels kept around owned art that overflows its cell. Default 4. */
  overflowPaddingPx?: number;
  /**
   * Inside the strict grid cell (not overflow gutters), keep pixels with alpha
   * above this threshold even when component labeling skipped them (e.g. model-drawn
   * text anti-alias). Foreign-owned components in the cell are still masked out.
   */
  preserveCellAlphaThreshold?: number;
}

interface SheetComponent {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ownerCell: number;
}

interface LabeledSheet {
  labels: Int32Array;
  components: SheetComponent[];
}

function buildCellLookup(bounds: number[], size: number): Int16Array {
  const lookup = new Int16Array(size);
  let bin = 0;
  for (let i = 0; i < size; i++) {
    while (bin < bounds.length - 2 && i >= bounds[bin + 1]!) bin++;
    lookup[i] = bin;
  }
  return lookup;
}

function isDividerResidue(
  component: { minX: number; minY: number; maxX: number; maxY: number; area: number },
  cellWidth: number,
  cellHeight: number
): boolean {
  const w = component.maxX - component.minX + 1;
  const h = component.maxY - component.minY + 1;
  const thinHorizontal = h <= 5 && w > cellWidth * 0.5;
  const thinVertical = w <= 5 && h > cellHeight * 0.5;
  return thinHorizontal || thinVertical;
}

function labelSheetComponents(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  xBounds: number[],
  yBounds: number[],
  minComponentArea: number
): LabeledSheet {
  const cols = xBounds.length - 1;
  const rows = yBounds.length - 1;
  const cellCount = cols * rows;
  const colOfX = buildCellLookup(xBounds, width);
  const rowOfY = buildCellLookup(yBounds, height);
  const avgCellWidth = width / cols;
  const avgCellHeight = height / rows;

  const foreground = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    if (!isSliceBackgroundPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) {
      foreground[p] = 1;
    }
  }

  const labels = new Int32Array(width * height); // 0 = background, -1 = dropped noise
  const components: SheetComponent[] = [];
  const stack: number[] = [];

  for (let start = 0; start < width * height; start++) {
    if (!foreground[start] || labels[start] !== 0) continue;

    const label = components.length + 1;
    labels[start] = label;
    stack.length = 0;
    stack.push(start);

    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    const cellMass = new Int32Array(cellCount);
    const pixels: number[] = [];

    while (stack.length > 0) {
      const p = stack.pop()!;
      pixels.push(p);
      area++;
      const x = p % width;
      const y = (p - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      cellMass[rowOfY[y]! * cols + colOfX[x]!]++;

      if (x > 0 && foreground[p - 1] && labels[p - 1] === 0) {
        labels[p - 1] = label;
        stack.push(p - 1);
      }
      if (x < width - 1 && foreground[p + 1] && labels[p + 1] === 0) {
        labels[p + 1] = label;
        stack.push(p + 1);
      }
      if (y > 0 && foreground[p - width] && labels[p - width] === 0) {
        labels[p - width] = label;
        stack.push(p - width);
      }
      if (y < height - 1 && foreground[p + width] && labels[p + width] === 0) {
        labels[p + width] = label;
        stack.push(p + width);
      }
    }

    const bbox = { minX, minY, maxX, maxY, area };
    if (area < minComponentArea || isDividerResidue(bbox, avgCellWidth, avgCellHeight)) {
      for (const p of pixels) labels[p] = -1;
      continue;
    }

    let ownerCell = 0;
    let bestMass = -1;
    for (let cell = 0; cell < cellCount; cell++) {
      if (cellMass[cell]! > bestMass) {
        bestMass = cellMass[cell]!;
        ownerCell = cell;
      }
    }

    // Tentative label always equals components.length + 1 when kept, since dropped
    // components reset their pixels to -1 without consuming a slot.
    components.push({ area, minX, minY, maxX, maxY, ownerCell });
  }

  return { labels, components };
}

/**
 * Slice a sheet into cols*rows frames (row-major) using fixed grid bounds only.
 * Copies every RGBA pixel inside each cell rectangle (no ownership masking).
 * Use for model-drawn text where anti-aliased stroke edges must survive slicing.
 */
export function sliceSheetByGridBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  xBounds: number[],
  yBounds: number[]
): RgbaFrameBuffer[] {
  const cols = xBounds.length - 1;
  const rows = yBounds.length - 1;
  const frames: RgbaFrameBuffer[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.round(xBounds[c]!);
      const y0 = Math.round(yBounds[r]!);
      const x1 = Math.round(xBounds[c + 1]!);
      const y1 = Math.round(yBounds[r + 1]!);
      const frameW = Math.max(1, x1 - x0);
      const frameH = Math.max(1, y1 - y0);
      const frame = new Uint8ClampedArray(frameW * frameH * 4);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const src = (y * width + x) * 4;
          const dst = ((y - y0) * frameW + (x - x0)) * 4;
          frame[dst] = data[src]!;
          frame[dst + 1] = data[src + 1]!;
          frame[dst + 2] = data[src + 2]!;
          frame[dst + 3] = data[src + 3]!;
        }
      }

      frames.push({ data: frame, width: frameW, height: frameH });
    }
  }

  return frames;
}

/**
 * Slice a sheet into cols*rows frames (row-major). Each frame spans its full grid
 * cell (expanded when owned art overflows into a gutter) with pixels of foreign
 * components cleared to transparent.
 */
export function sliceSheetByComponentOwnership(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  xBounds: number[],
  yBounds: number[],
  options: OwnershipSliceOptions = {}
): RgbaFrameBuffer[] {
  const minComponentArea = options.minComponentArea ?? 12;
  const overflowPaddingPx = options.overflowPaddingPx ?? 4;
  const preserveCellAlphaThreshold = options.preserveCellAlphaThreshold;
  const cols = xBounds.length - 1;
  const rows = yBounds.length - 1;

  const { labels, components } = labelSheetComponents(
    data,
    width,
    height,
    xBounds,
    yBounds,
    minComponentArea
  );

  const frames: RgbaFrameBuffer[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = r * cols + c;
      const cellX0 = Math.round(xBounds[c]!);
      const cellY0 = Math.round(yBounds[r]!);
      const cellX1 = Math.round(xBounds[c + 1]!);
      const cellY1 = Math.round(yBounds[r + 1]!);
      let x0 = cellX0;
      let y0 = cellY0;
      let x1 = cellX1;
      let y1 = cellY1;

      for (const component of components) {
        if (component.ownerCell !== cell) continue;
        x0 = Math.min(x0, component.minX - overflowPaddingPx);
        y0 = Math.min(y0, component.minY - overflowPaddingPx);
        x1 = Math.max(x1, component.maxX + 1 + overflowPaddingPx);
        y1 = Math.max(y1, component.maxY + 1 + overflowPaddingPx);
      }
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(width, x1);
      y1 = Math.min(height, y1);

      const frameW = Math.max(1, x1 - x0);
      const frameH = Math.max(1, y1 - y0);
      const frame = new Uint8ClampedArray(frameW * frameH * 4);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = y * width + x;
          const label = labels[p]!;
          const alpha = data[p * 4 + 3]!;
          const inStrictCell =
            x >= cellX0 && x < cellX1 && y >= cellY0 && y < cellY1;

          let copy = false;
          if (label > 0 && components[label - 1]!.ownerCell === cell) {
            copy = true;
          } else if (
            preserveCellAlphaThreshold !== undefined &&
            inStrictCell &&
            label === 0 &&
            alpha > preserveCellAlphaThreshold
          ) {
            copy = true;
          }
          if (!copy) continue;

          const src = p * 4;
          const dst = ((y - y0) * frameW + (x - x0)) * 4;
          frame[dst] = data[src]!;
          frame[dst + 1] = data[src + 1]!;
          frame[dst + 2] = data[src + 2]!;
          frame[dst + 3] = alpha;
        }
      }

      frames.push({ data: frame, width: frameW, height: frameH });
    }
  }
  return frames;
}

/**
 * Crop a frame to its opaque content bounding box plus margin.
 * Run after caption overlay so both art and text are preserved.
 */
export function trimFrameToContent(
  frame: RgbaFrameBuffer,
  marginRatio: number = 0.05
): RgbaFrameBuffer {
  // Drop chroma speckles / broken speed-line crumbs before measuring bounds
  // (sticker-09 mark: floating islands of ~12–14 px near hair and arm).
  clearSmallOpaqueIslands(frame.data, frame.width, frame.height, {
    maxIslandSize: 80,
  });

  const { data, width, height } = frame;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return frame;

  const margin = Math.max(6, Math.round(Math.min(width, height) * marginRatio));
  const x0 = Math.max(0, minX - margin);
  const y0 = Math.max(0, minY - margin);
  const x1 = Math.min(width, maxX + 1 + margin);
  const y1 = Math.min(height, maxY + 1 + margin);
  const outW = x1 - x0;
  const outH = y1 - y0;
  if (outW === width && outH === height) return frame;

  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = y0; y < y1; y++) {
    const srcRow = (y * width + x0) * 4;
    const dstRow = (y - y0) * outW * 4;
    out.set(data.subarray(srcRow, srcRow + outW * 4), dstRow);
  }
  return { data: out, width: outW, height: outH };
}
