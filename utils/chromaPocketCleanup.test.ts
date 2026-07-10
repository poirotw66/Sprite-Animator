import { describe, expect, it } from 'vitest';
import { clearGuidedGreenPockets } from './chromaPocketCleanup';
import { fuzzPercentToKeyMax } from './chromaSimilarity';

const KEY = { r: 0, g: 255, b: 0 };
const KEY_MAX = fuzzPercentToKeyMax(35);

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

function fillGreenBg(data: Uint8ClampedArray, w: number, h: number, inset: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const center = x >= inset && x < w - inset && y >= inset && y < h - inset;
      data[i] = center ? 220 : 0;
      data[i + 1] = center ? 30 : 255;
      data[i + 2] = center ? 40 : 0;
      data[i + 3] = 255;
    }
  }
}

describe('clearGuidedGreenPockets', () => {
  it('clears soft enclosed pocket green (sticker-02/15 armpit residue)', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreenBg(data, w, h, 6);
    // 3×3 pocket cluster inside subject (not black line, not intentional prop).
    for (let y = 12; y <= 14; y++) {
      for (let x = 12; x <= 14; x++) {
        const i = (y * w + x) * 4;
        data[i] = 19;
        data[i + 1] = 29;
        data[i + 2] = 13;
        data[i + 3] = 255;
      }
    }

    const cleared = clearGuidedGreenPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
    expect(cleared).toBeGreaterThanOrEqual(9);
    expect(alphaAt(data, w, 13, 13)).toBe(0);
    expect(alphaAt(data, w, 10, 10)).toBe(255);
  });

  it('keeps neutral gray black-line AA pixels', () => {
    const w = 24;
    const h = 24;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreenBg(data, w, h, 4);
    const px = 18;
    const py = 12;
    const i = (py * w + px) * 4;
    data[i] = 66;
    data[i + 1] = 66;
    data[i + 2] = 64;
    data[i + 3] = 255;

    clearGuidedGreenPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
    expect(alphaAt(data, w, px, py)).toBe(255);
  });

  it('keeps a lone neon green accent inside the subject', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreenBg(data, w, h, 8);
    const px = 14;
    const py = 14;
    const i = (py * w + px) * 4;
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;

    clearGuidedGreenPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
    expect(alphaAt(data, w, px, py)).toBe(255);
  });

  it('keeps intentional interior green prop above distance threshold', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreenBg(data, w, h, 8);
    const x0 = 12;
    const y0 = 12;
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = x0; x < x0 + 4; x++) {
        const i = (y * w + x) * 4;
        data[i] = 20;
        data[i + 1] = 100;
        data[i + 2] = 23;
        data[i + 3] = 255;
      }
    }

    clearGuidedGreenPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
    expect(alphaAt(data, w, x0, y0)).toBe(255);
  });
});
