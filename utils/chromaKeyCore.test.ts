import { describe, it, expect } from 'vitest';
import { rgbToHsl, processChromaKey } from './chromaKeyCore';
import {
  isChromaLike,
  chromaDistanceToKey,
  fuzzPercentToKeyMax,
} from './chromaSimilarity';

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

/** Prop origin inside red subject, away from center-grid flood seeds (50% + 25%/75% cross). */
function greenPropOrigin(inset: number): { x0: number; y0: number } {
  return { x0: inset + 4, y0: inset + 4 };
}

/** Interior prop RGB: chroma-like to green key, distance just above keyMax*0.95 so certain-hole skips it. */
const INTERIOR_PROP_RGB = { r: 20, g: 100, b: 23 } as const;

function makeGreenWithRedCenterAndGreenProp(w: number, h: number, inset: number) {
  const data = makeGreenWithRedCenter(w, h, inset);
  // 4×4 green accent fully inside red — off center/25%/75% seeds, not edge-touching.
  const { x0, y0 } = greenPropOrigin(inset);
  for (let y = y0; y < y0 + 4; y++) {
    for (let x = x0; x < x0 + 4; x++) {
      const i = (y * w + x) * 4;
      data[i] = INTERIOR_PROP_RGB.r;
      data[i + 1] = INTERIOR_PROP_RGB.g;
      data[i + 2] = INTERIOR_PROP_RGB.b;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('processChromaKey hard cases', () => {
  it('keeps an interior green prop that is not edge-connected', () => {
    const w = 40, h = 40, inset = 8;
    const key = { r: 0, g: 255, b: 0 };
    const keyMax = fuzzPercentToKeyMax(35);
    const { r, g, b } = INTERIOR_PROP_RGB;
    expect(isChromaLike(r, g, b, key, 'key', keyMax)).toBe(true);
    expect(chromaDistanceToKey(r, g, b, key)).toBeGreaterThanOrEqual(keyMax * 0.95);

    const data = makeGreenWithRedCenterAndGreenProp(w, h, inset);
    processChromaKey(data, w, h, key, 35, () => {});
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    const { x0, y0 } = greenPropOrigin(inset);
    expect(alphaAt(data, w, x0, y0)).toBeGreaterThan(200);
  });

  it('non-guided certain-hole punches disconnected interior chroma', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeGreenWithRedCenter(w, h, inset);
    // Pure neon green pixel inside red, off center-grid seeds
    const px = inset + 6;
    const py = inset + 6;
    const i = (py * w + px) * 4;
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, px, py)).toBe(15);
  });

  it('guided path does not hole-punch interior chroma-like pixels', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeGreenWithRedCenterAndGreenProp(w, h, inset);
    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    // Prop lives at inset+4..inset+8, not image center (Task 3 layout).
    expect(alphaAt(data, w, inset + 5, inset + 5)).toBeGreaterThan(200);
  });

  it('guided: true does not certain-hole-punch a pure neon green interior pocket', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeGreenWithRedCenter(w, h, inset);
    const px = inset + 6;
    const py = inset + 6;
    const i = (py * w + px) * 4;
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, px, py)).toBeGreaterThan(200);
  });
});
