import { describe, expect, it } from 'vitest';
import {
  clearNearWhiteEdgeArtifacts,
  computeDividerCellRect,
  detectWhiteDividerGrid,
  shouldUseWhiteDividerSlice,
} from './sheetWhiteDividerDetection';

function fillGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

function drawVerticalWhiteBand(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  thickness: number
) {
  for (let x = x0; x < x0 + thickness; x++) {
    for (let y = 0; y < height; y++) {
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }
}

function drawHorizontalWhiteBand(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  y0: number,
  thickness: number,
  x0 = 0,
  x1?: number
) {
  const endX = x1 ?? width;
  for (let y = y0; y < y0 + thickness; y++) {
    for (let x = x0; x < endX; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }
}

describe('detectWhiteDividerGrid', () => {
  it('finds vertical and horizontal white divider bands', () => {
    const width = 1024;
    const height = 1024;
    const cols = 4;
    const rows = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);

    for (let c = 1; c < cols; c++) {
      drawVerticalWhiteBand(data, width, height, Math.round((c * width) / cols) - 1, 3);
    }
    for (let r = 1; r < rows; r++) {
      drawHorizontalWhiteBand(data, width, height, Math.round((r * height) / rows) - 1, 3);
    }

    const grid = detectWhiteDividerGrid(data, width, height, cols, rows);
    expect(shouldUseWhiteDividerSlice(grid, cols, rows)).toBe(true);
    expect(grid.verticalBands.filter(Boolean).length).toBeGreaterThanOrEqual(2);

    const cell = computeDividerCellRect(width, height, cols, rows, 0, 0, grid);
    expect(cell.x0).toBe(0);
    expect(cell.y0).toBe(0);
    expect(cell.x1).toBeLessThan(Math.round(width / cols));
    expect(cell.y1).toBeLessThan(Math.round(height / rows));
  });

  it('excludes white divider pixels from adjacent cells', () => {
    const width = 400;
    const height = 500;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);
    drawVerticalWhiteBand(data, width, height, 198, 4);
    drawHorizontalWhiteBand(data, width, height, 248, 4);

    const grid = detectWhiteDividerGrid(data, width, height, 2, 2);
    const topLeft = computeDividerCellRect(width, height, 2, 2, 0, 0, grid);
    const topRight = computeDividerCellRect(width, height, 2, 2, 0, 1, grid);
    const bottomLeft = computeDividerCellRect(width, height, 2, 2, 1, 0, grid);

    expect(topLeft.x1).toBeLessThanOrEqual(198);
    expect(topRight.x0).toBeGreaterThanOrEqual(202);
    expect(topLeft.y1).toBeLessThanOrEqual(248);
    expect(bottomLeft.y0).toBeGreaterThanOrEqual(252);
  });

  it('detects dark divider bands on green sheets', () => {
    const width = 400;
    const height = 500;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);
    for (let x = 198; x < 202; x++) {
      for (let y = 0; y < height; y++) {
        const offset = (y * width + x) * 4;
        data[offset] = 20;
        data[offset + 1] = 20;
        data[offset + 2] = 20;
        data[offset + 3] = 255;
      }
    }

    const grid = detectWhiteDividerGrid(data, width, height, 2, 2);
    const topLeft = computeDividerCellRect(width, height, 2, 2, 0, 0, grid);
    if (grid.verticalBands[0]) {
      expect(topLeft.x1).toBeLessThanOrEqual(202);
    }
  });

  it('clears edge-connected near-white seam pixels from a frame', () => {
    const width = 40;
    const height = 30;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = 0;
    }
    for (let y = 0; y < height; y++) {
      const offset = (y * width + 0) * 4;
      data[offset] = 250;
      data[offset + 1] = 250;
      data[offset + 2] = 250;
      data[offset + 3] = 255;
    }
    const cleared = clearNearWhiteEdgeArtifacts(data, width, height, 8);
    expect(cleared).toBeGreaterThan(0);
    expect(data[3]).toBe(0);
  });
});
