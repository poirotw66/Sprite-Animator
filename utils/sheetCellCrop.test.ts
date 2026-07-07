import { describe, expect, it } from 'vitest';
import { computeCellCropRect } from './sheetCellCrop';

function fillGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

function paintRect(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = 30;
      data[offset + 1] = 30;
      data[offset + 2] = 30;
      data[offset + 3] = 255;
    }
  }
}

describe('computeCellCropRect', () => {
  it('includes gutter overflow when it belongs to the same column component', () => {
    const width = 512;
    const height = 400;
    const cols = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);

    paintRect(data, width, 40, 120, 280, 200);

    const xBounds = [0, 256, 512];
    const yBoundsPerColumn = [
      [0, 200, 400],
      [0, 200, 400],
    ];

    const crop = computeCellCropRect(data, width, height, cols, 0, 0, xBounds, yBoundsPerColumn);
    expect(crop.x0).toBeLessThanOrEqual(40);
    expect(crop.x1).toBeGreaterThanOrEqual(280);
    expect(crop.y0).toBeLessThanOrEqual(120);
    expect(crop.y1).toBeGreaterThanOrEqual(200);
  });
});
