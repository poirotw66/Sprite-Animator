import { describe, expect, it } from 'vitest';
import { shouldUseGuidedChromaPath } from './chromaGuidedDetect';

function fillGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255;
  }
}

describe('shouldUseGuidedChromaPath', () => {
  it('returns false when guided is explicitly false', () => {
    const data = new Uint8ClampedArray(20 * 20 * 4);
    fillGreen(data);
    expect(
      shouldUseGuidedChromaPath(data, 20, 20, { r: 0, g: 255, b: 0 }, false)
    ).toBe(false);
  });

  it('returns true when guided is explicitly true', () => {
    const data = new Uint8ClampedArray(4);
    expect(
      shouldUseGuidedChromaPath(data, 1, 1, { r: 0, g: 255, b: 0 }, true)
    ).toBe(true);
  });

  it('auto-detects a solid chroma field with seam samples as guided-like', () => {
    const w = 40, h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreen(data);
    // red blocks in a 2x2 cell pattern leaving green gutters
    const paint = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          data[i] = 220; data[i + 1] = 30; data[i + 2] = 40;
        }
    };
    paint(2, 2, 18, 18);
    paint(22, 2, 38, 18);
    paint(2, 22, 18, 38);
    paint(22, 22, 38, 38);
    expect(
      shouldUseGuidedChromaPath(data, w, h, { r: 0, g: 255, b: 0 }, undefined)
    ).toBe(true);
  });
});
