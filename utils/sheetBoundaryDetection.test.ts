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
    expect(Math.abs(yBounds[1]! - 100)).toBeLessThanOrEqual(12);
    expect(Math.abs(yBounds[2]! - 230)).toBeLessThanOrEqual(12);
    expect(Math.abs(yBounds[3]! - 360)).toBeLessThanOrEqual(12);
  });

  it('finds row seams when sticker bodies cross the gutter at column centers', () => {
    const width = 800;
    const height = 1000;
    const cols = 2;
    const rows = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);

    const rowSeams = [200, 450, 700];
    for (const y of rowSeams) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        data[offset + 3] = 0;
      }
      const centerStart = Math.floor(width * 0.3);
      const centerEnd = Math.ceil(width * 0.7);
      for (let x = centerStart; x < centerEnd; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = 40;
        data[offset + 1] = 40;
        data[offset + 2] = 40;
        data[offset + 3] = 255;
      }
    }

    const { yBounds } = detectSheetGridBoundaries(data, width, height, cols, rows);
    expect(Math.abs(yBounds[1]! - 200)).toBeLessThanOrEqual(12);
    expect(Math.abs(yBounds[2]! - 450)).toBeLessThanOrEqual(12);
    expect(Math.abs(yBounds[3]! - 700)).toBeLessThanOrEqual(12);
  });
});
