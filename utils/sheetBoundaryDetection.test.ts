import { describe, expect, it } from 'vitest';
import { detectSheetGridBoundaries } from './sheetBoundaryDetection';

function fillGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

describe('detectSheetGridBoundaries', () => {
  it('finds uneven row seams near background-heavy lines', () => {
    const width = 400;
    const height = 500;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);

    const rowSeams = [100, 230, 360];
    for (const y of rowSeams) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        data[offset + 3] = 0;
      }
    }

    const { yBounds } = detectSheetGridBoundaries(data, width, height, 2, 4);
    expect(yBounds[0]).toBe(0);
    expect(yBounds[4]).toBe(height);
    expect(Math.abs(yBounds[1]! - 100)).toBeLessThanOrEqual(10);
    expect(Math.abs(yBounds[2]! - 230)).toBeLessThanOrEqual(10);
    expect(Math.abs(yBounds[3]! - 360)).toBeLessThanOrEqual(10);
  });
});
