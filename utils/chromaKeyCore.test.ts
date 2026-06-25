import { describe, it, expect } from 'vitest';
import { rgbToHsl, processChromaKey } from './chromaKeyCore';

/** Fill a w*h RGBA buffer: green background with a solid red square in the center. */
function makeGreenWithRedCenter(w: number, h: number, inset: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isCenter = x >= inset && x < w - inset && y >= inset && y < h - inset;
      data[i] = isCenter ? 220 : 0; // R
      data[i + 1] = isCenter ? 30 : 255; // G
      data[i + 2] = isCenter ? 40 : 0; // B
      data[i + 3] = 255; // A
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe('rgbToHsl', () => {
  it('maps pure neon green to ~120° hue, full saturation', () => {
    const { h, s } = rgbToHsl(0, 255, 0);
    expect(Math.round(h)).toBe(120);
    expect(s).toBeCloseTo(1, 5);
  });

  it('maps pure magenta to ~300° hue', () => {
    expect(Math.round(rgbToHsl(255, 0, 255).h)).toBe(300);
  });
});

describe('processChromaKey (green screen)', () => {
  it('clears the green background and keeps the red subject opaque', () => {
    const w = 40, h = 40, inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    // Corner (green background) becomes transparent.
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, w - 1, h - 1)).toBe(0);
    // Center (red subject) stays opaque.
    expect(alphaAt(data, w, w / 2, h / 2)).toBe(255);
  });
});
