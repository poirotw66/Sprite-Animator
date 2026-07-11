import { describe, expect, it } from 'vitest';
import {
  sliceSheetByComponentOwnership,
  sliceSheetByGridBounds,
  trimFrameToContent,
} from './sheetComponentSlicer';

function makeTransparentSheet(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

function paintOpaqueRect(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = 120;
      data[offset + 1] = 90;
      data[offset + 2] = 60;
      data[offset + 3] = 255;
    }
  }
}

const alphaAt = (
  frame: { data: Uint8ClampedArray; width: number },
  x: number,
  y: number
): number => frame.data[(y * frame.width + x) * 4 + 3]!;

describe('sliceSheetByComponentOwnership', () => {
  const width = 200;
  const height = 200;
  const xBounds = [0, 100, 200];
  const yBounds = [0, 100, 200];

  it('masks out art belonging to the neighboring row even when it crosses the boundary', () => {
    const data = makeTransparentSheet(width, height);
    // Top-left cell art that dips 10px into the bottom-left cell.
    paintOpaqueRect(data, width, 20, 20, 80, 110);
    // Bottom-left cell art.
    paintOpaqueRect(data, width, 20, 130, 80, 190);

    const frames = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds);
    expect(frames).toHaveLength(4);

    const bottomLeft = frames[2]!;
    // The overflow strip (y 100..110 in sheet space) belongs to the top cell → transparent here.
    const overflowRowY = 105 - Math.round(200 - bottomLeft.height); // sheet y → frame y
    expect(alphaAt(bottomLeft, 50, Math.max(0, overflowRowY))).toBe(0);
    // Its own art is intact.
    const ownRowY = 150 - (200 - bottomLeft.height);
    expect(alphaAt(bottomLeft, 50, ownRowY)).toBe(255);
  });

  it('keeps the full cell area so empty caption space survives slicing', () => {
    const data = makeTransparentSheet(width, height);
    paintOpaqueRect(data, width, 30, 60, 70, 90); // small art inside top-left cell

    const frames = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds);
    const topLeft = frames[0]!;
    expect(topLeft.width).toBe(100);
    expect(topLeft.height).toBe(100);
  });

  it('expands a cell to include owned art overflowing into the gutter', () => {
    const data = makeTransparentSheet(width, height);
    // Mostly in top-left, foot reaching 12px into the cell below.
    paintOpaqueRect(data, width, 30, 30, 70, 112);

    const frames = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds);
    const topLeft = frames[0]!;
    expect(topLeft.height).toBeGreaterThanOrEqual(112);
    // The foot is preserved (no flat cut at the cell boundary).
    expect(alphaAt(topLeft, 50, 108)).toBe(255);
  });

  it('drops thin divider-line residue', () => {
    const data = makeTransparentSheet(width, height);
    paintOpaqueRect(data, width, 30, 30, 70, 80); // real art
    paintOpaqueRect(data, width, 10, 99, 90, 101); // 2px horizontal line across the seam

    const frames = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds);
    const topLeft = frames[0]!;
    expect(alphaAt(topLeft, 50, 99)).toBe(0);
    expect(alphaAt(topLeft, 50, 50)).toBe(255);
  });

  it('preserves unlabeled semi-transparent pixels inside strict cell bounds', () => {
    const data = makeTransparentSheet(width, height);
    paintOpaqueRect(data, width, 30, 60, 70, 90);
    const edgeOffset = (40 * width + 50) * 4;
    // Green-tinted semi-transparent edge: visible after chroma key but not foreground-labeled.
    data[edgeOffset] = 20;
    data[edgeOffset + 1] = 180;
    data[edgeOffset + 2] = 20;
    data[edgeOffset + 3] = 64;

    const without = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds);
    const withPreserve = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds, {
      preserveCellAlphaThreshold: 8,
    });

    expect(alphaAt(without[0]!, 50, 40)).toBe(0);
    expect(alphaAt(withPreserve[0]!, 50, 40)).toBe(64);
  });

  it('still masks foreign-owned pixels inside strict cell bounds when preserving alpha', () => {
    const data = makeTransparentSheet(width, height);
    paintOpaqueRect(data, width, 30, 30, 110, 80); // top-left art spilling into top-right cell

    const frames = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds, {
      preserveCellAlphaThreshold: 8,
    });
    const topRight = frames[1]!;
    expect(alphaAt(topRight, 5, 50)).toBe(0);
  });
});

describe('sliceSheetByGridBounds', () => {
  it('copies every pixel inside each cell rectangle including semi-transparent edges', () => {
    const width = 200;
    const height = 200;
    const xBounds = [0, 100, 200];
    const yBounds = [0, 100, 200];
    const data = makeTransparentSheet(width, height);
    const offset = (50 * width + 50) * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 64;

    const frames = sliceSheetByGridBounds(data, width, height, xBounds, yBounds);
    expect(frames[0]!.width).toBe(100);
    expect(frames[0]!.height).toBe(100);
    expect(alphaAt(frames[0]!, 50, 50)).toBe(64);
  });
});

describe('trimFrameToContent', () => {
  it('crops to content bounding box plus margin', () => {
    const width = 100;
    const height = 100;
    const data = makeTransparentSheet(width, height);
    paintOpaqueRect(data, width, 40, 40, 60, 60);

    const trimmed = trimFrameToContent({ data, width, height }, 0.05);
    expect(trimmed.width).toBeLessThan(width);
    expect(trimmed.height).toBeLessThan(height);
    // 20px content + margin on both sides (min margin 6).
    expect(trimmed.width).toBeGreaterThanOrEqual(20 + 12);
  });

  it('returns the frame unchanged when fully transparent', () => {
    const width = 50;
    const height = 50;
    const frame = { data: makeTransparentSheet(width, height), width, height };
    const trimmed = trimFrameToContent(frame);
    expect(trimmed.width).toBe(width);
    expect(trimmed.height).toBe(height);
  });
});
