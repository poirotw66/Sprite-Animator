import { describe, expect, it } from 'vitest';
import {
  computeOptimizedSliceFromMargins,
  measureContentMargins,
} from './optimizeSliceSettings';

function fillBackground(data: Uint8ClampedArray, width: number, height: number) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
) {
  const idx = (y * width + x) * 4;
  data[idx] = 40;
  data[idx + 1] = 40;
  data[idx + 2] = 40;
  data[idx + 3] = 255;
}

describe('measureContentMargins', () => {
  it('detects uniform outer margins', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    fillBackground(data, width, height);
    for (let y = 20; y < 80; y++) {
      for (let x = 20; x < 80; x++) {
        setPixel(data, width, x, y);
      }
    }

    expect(measureContentMargins(data, width, height)).toEqual({
      left: 20,
      right: 20,
      top: 20,
      bottom: 20,
    });
  });
});

describe('computeOptimizedSliceFromMargins', () => {
  it('uses zero shift in conservative mode', () => {
    const result = computeOptimizedSliceFromMargins(
      1000,
      1000,
      4,
      4,
      { left: 40, right: 40, top: 40, bottom: 40 },
      { conservative: true }
    );
    expect(result.shiftX).toBe(0);
    expect(result.shiftY).toBe(0);
    expect(result.paddingLeft).toBeLessThan(40);
    expect(result.paddingLeft).toBeGreaterThan(0);
  });

  it('applies smaller padding than measured margin due to safety inset', () => {
    const result = computeOptimizedSliceFromMargins(
      400,
      400,
      4,
      4,
      { left: 30, right: 30, top: 30, bottom: 30 },
      { conservative: true }
    );
    expect(result.paddingLeft).toBeLessThan(30);
  });
});
