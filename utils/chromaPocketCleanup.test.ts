import { describe, expect, it } from 'vitest';
import { clearGuidedChromaPockets } from './chromaPocketCleanup';
import { fuzzPercentToKeyMax } from './chromaSimilarity';

const KEY = { r: 0, g: 255, b: 0 };
const MAGENTA_KEY = { r: 255, g: 0, b: 255 };
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

describe('clearGuidedChromaPockets', () => {
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

    const cleared = clearGuidedChromaPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
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

    clearGuidedChromaPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
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

    clearGuidedChromaPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
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

    clearGuidedChromaPockets(data, w, h, { key: KEY, keyMax: KEY_MAX });
    expect(alphaAt(data, w, x0, y0)).toBe(255);
  });
});

function fillMagentaBg(data: Uint8ClampedArray, w: number, h: number, inset: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const center = x >= inset && x < w - inset && y >= inset && y < h - inset;
      data[i] = center ? 40 : 255;
      data[i + 1] = center ? 190 : 0;
      data[i + 2] = center ? 60 : 255;
      data[i + 3] = 255;
    }
  }
}

const magentaOptions = { key: MAGENTA_KEY, keyMax: KEY_MAX, target: 'magenta' } as const;

/** Magenta counterparts of the green cases above (two channels over one). */
describe('clearGuidedChromaPockets (magenta)', () => {
  it('clears a soft enclosed pocket of balanced magenta residue', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    fillMagentaBg(data, w, h, 6);
    // 3×3 pocket cluster: R and B both ~14 above G, R≈B (inherited from the key).
    for (let y = 12; y <= 14; y++) {
      for (let x = 12; x <= 14; x++) {
        const i = (y * w + x) * 4;
        data[i] = 29;
        data[i + 1] = 13;
        data[i + 2] = 27;
        data[i + 3] = 255;
      }
    }

    const cleared = clearGuidedChromaPockets(data, w, h, magentaOptions);
    expect(cleared).toBeGreaterThanOrEqual(9);
    expect(alphaAt(data, w, 13, 13)).toBe(0);
    expect(alphaAt(data, w, 10, 10)).toBe(255);
  });

  it('keeps neutral gray black-line AA pixels', () => {
    const w = 24;
    const h = 24;
    const data = new Uint8ClampedArray(w * h * 4);
    fillMagentaBg(data, w, h, 4);
    const px = 18;
    const py = 12;
    const i = (py * w + px) * 4;
    data[i] = 66;
    data[i + 1] = 64;
    data[i + 2] = 66;
    data[i + 3] = 255;

    clearGuidedChromaPockets(data, w, h, magentaOptions);
    expect(alphaAt(data, w, px, py)).toBe(255);
  });

  it('keeps a lone magenta accent inside the subject', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    fillMagentaBg(data, w, h, 8);
    const px = 14;
    const py = 14;
    const i = (py * w + px) * 4;
    data[i] = 60;
    data[i + 1] = 40;
    data[i + 2] = 58;
    data[i + 3] = 255;

    clearGuidedChromaPockets(data, w, h, magentaOptions);
    expect(alphaAt(data, w, px, py)).toBe(255);
  });

  it('keeps intentional interior magenta prop above the excess threshold', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    fillMagentaBg(data, w, h, 8);
    const x0 = 12;
    const y0 = 12;
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = x0; x < x0 + 4; x++) {
        const i = (y * w + x) * 4;
        data[i] = 100;
        data[i + 1] = 40;
        data[i + 2] = 95;
        data[i + 3] = 255;
      }
    }

    clearGuidedChromaPockets(data, w, h, magentaOptions);
    expect(alphaAt(data, w, x0, y0)).toBe(255);
  });

  it('keeps warm rose ink whose R and B are too unbalanced for key spill', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    fillMagentaBg(data, w, h, 6);
    // Same excess as the cleared pocket above, but |R − B| = 45 > the balance gate.
    for (let y = 12; y <= 14; y++) {
      for (let x = 12; x <= 14; x++) {
        const i = (y * w + x) * 4;
        data[i] = 110;
        data[i + 1] = 50;
        data[i + 2] = 65;
        data[i + 3] = 255;
      }
    }

    const cleared = clearGuidedChromaPockets(data, w, h, magentaOptions);
    expect(cleared).toBe(0);
    expect(alphaAt(data, w, 13, 13)).toBe(255);
  });

  it('leaves magenta residue untouched when targeting green', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    fillMagentaBg(data, w, h, 6);
    for (let y = 12; y <= 14; y++) {
      for (let x = 12; x <= 14; x++) {
        const i = (y * w + x) * 4;
        data[i] = 29;
        data[i + 1] = 13;
        data[i + 2] = 27;
        data[i + 3] = 255;
      }
    }

    expect(clearGuidedChromaPockets(data, w, h, { key: KEY, keyMax: KEY_MAX })).toBe(0);
  });
});
