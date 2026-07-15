import { describe, it, expect } from 'vitest';
import { rgbToHsl, processChromaKeyLegacy } from './chromaKeyLegacy';

function makeGreenWithRedCenter(w: number, h: number, inset: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isCenter = x >= inset && x < w - inset && y >= inset && y < h - inset;
      data[i] = isCenter ? 220 : 0;
      data[i + 1] = isCenter ? 30 : 255;
      data[i + 2] = isCenter ? 40 : 0;
      data[i + 3] = 255;
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe('chromaKeyLegacy', () => {
  it('maps pure green to ~120° hue', () => {
    expect(Math.round(rgbToHsl(0, 255, 0).h)).toBe(120);
  });

  it('clears green background and keeps red subject opaque', () => {
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    processChromaKeyLegacy(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, w / 2, h / 2)).toBe(255);
  });

  it('erases muted olive fringe instead of leaving a gray spike', () => {
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 47;
    data[i + 1] = 158;
    data[i + 2] = 30;
    data[i + 3] = 255;

    processChromaKeyLegacy(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, fx, fy)).toBe(0);
  });

  it('despills yellow-green olive hair AA where R≈G > B', () => {
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 56;
    data[i + 1] = 59;
    data[i + 2] = 49;
    data[i + 3] = 255;

    processChromaKeyLegacy(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    expect(Math.min(r, g) - b).toBeLessThanOrEqual(1);
    expect(g - Math.max(r, b)).toBeLessThanOrEqual(1);
  });

  it('hard-caps edge green excess on soft spill', () => {
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 70;
    data[i + 1] = 103;
    data[i + 2] = 69;
    data[i + 3] = 255;

    processChromaKeyLegacy(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    if (alphaAt(data, w, fx, fy)! > 0) {
      expect(data[i + 1]! - Math.max(data[i]!, data[i + 2]!)).toBeLessThanOrEqual(1);
    }
  });

  it('preserves cyan/mint caption strokes near transparency', () => {
    // sheet-2 sticker-22「沒電了」青字 was erased by strong spill cleanup.
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 64;
    data[i + 1] = 220;
    data[i + 2] = 200;
    data[i + 3] = 255;

    processChromaKeyLegacy(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    expect(alphaAt(data, w, fx, fy)).toBeGreaterThan(200);
    expect(data[i + 2]!).toBeGreaterThan(140);
    expect(data[i + 2]! + data[i + 1]!).toBeGreaterThan(data[i]! * 2);
  });

  it('preserves darker teal caption fills (not just bright mint)', () => {
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset + 2;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    // Real interior of「沒電了」before certainHole punched it: (8,176,131)
    data[i] = 8;
    data[i + 1] = 176;
    data[i + 2] = 131;
    data[i + 3] = 255;

    processChromaKeyLegacy(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});

    expect(alphaAt(data, w, fx, fy)).toBeGreaterThan(200);
    expect(data[i + 2]!).toBeGreaterThan(100);
  });
});
