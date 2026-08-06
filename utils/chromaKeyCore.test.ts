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
    // Certain-hole punches to near-transparent; edge-band strong-spill erase may
    // finish the job to fully transparent — either is correct cleanup.
    expect(alphaAt(data, w, px, py)).toBeLessThanOrEqual(15);
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

  it('erases muted olive fringe that fails YCbCr key match', () => {
    // Real residue from twice-1 sheet-2 sticker-09: dark olive AA that stays opaque
    // because chromaDistance >> KEY_MAX. Strong edge spill is erased (not grayed).
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

    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, fx, fy)).toBe(0);
  });

  it('despills yellow-green olive hair AA where R≈G > B', () => {
    // After hard G-cap, hair edges often look like 94,94,82 — still reads as lime.
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

    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    expect(Math.min(r, g) - b).toBeLessThanOrEqual(1);
    expect(g - Math.max(r, b)).toBeLessThanOrEqual(1);
  });

  it('despills near-white yellow-green edge tint', () => {
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 251;
    data[i + 1] = 255;
    data[i + 2] = 240;
    data[i + 3] = 255;

    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    expect(Math.min(r, g) - b).toBeLessThanOrEqual(1);
  });

  it('erases strong edge green that fails YCbCr key instead of leaving a gray blob', () => {
    // sticker-09 mark2: raw (54,148,36) d≈52 > soft band → stayed opaque → despill
    // grayed to (56,56,54) attached to hair. Must clear alpha on the edge band.
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 54;
    data[i + 1] = 148;
    data[i + 2] = 36;
    data[i + 3] = 255;

    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, fx, fy)).toBe(0);
  });

  it('erases borderline green spill a few px inside the opaque mass', () => {
    // Remaining mark2 pixels: raw (53,81,32) contrast≈38.5, often outside radius-2 band.
    const w = 40;
    const h = 40;
    const inset = 12;
    const data = makeGreenWithRedCenter(w, h, inset);
    // One step inside the subject edge — still near transparency, sparse toward bg.
    const fx = inset + 1;
    const fy = Math.floor(h / 2);
    const i = (fy * w + fx) * 4;
    data[i] = 53;
    data[i + 1] = 81;
    data[i + 2] = 32;
    data[i + 3] = 255;

    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });

    expect(alphaAt(data, w, fx, fy)).toBe(0);
  });

  it('clears enclosed green pocket clusters in guided mode', () => {
    const w = 40;
    const h = 40;
    const inset = 8;
    const data = makeGreenWithRedCenter(w, h, inset);
    for (let y = 14; y <= 16; y++) {
      for (let x = 14; x <= 16; x++) {
        const i = (y * w + x) * 4;
        data[i] = 19;
        data[i + 1] = 29;
        data[i + 2] = 13;
        data[i + 3] = 255;
      }
    }

    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
      guided: true,
    });

    expect(alphaAt(data, w, 15, 15)).toBe(0);
    expect(alphaAt(data, w, inset + 5, inset + 5)).toBe(255);
  });
});

const MAGENTA_KEY = { r: 255, g: 0, b: 255 } as const;

/** Fill a w*h RGBA buffer: magenta background with a solid green square in the center. */
function makeMagentaWithGreenCenter(w: number, h: number, inset: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isCenter = x >= inset && x < w - inset && y >= inset && y < h - inset;
      data[i] = isCenter ? 40 : 255; // R
      data[i + 1] = isCenter ? 190 : 0; // G
      data[i + 2] = isCenter ? 60 : 255; // B
      data[i + 3] = 255; // A
    }
  }
  return data;
}

function paint(data: Uint8ClampedArray, w: number, x: number, y: number, rgb: readonly number[]) {
  const i = (y * w + x) * 4;
  data[i] = rgb[0]!;
  data[i + 1] = rgb[1]!;
  data[i + 2] = rgb[2]!;
  data[i + 3] = 255;
}

/** Interior prop RGB: chroma-like to magenta key, distance just above keyMax*0.95. */
const INTERIOR_MAGENTA_PROP_RGB = { r: 95, g: 10, b: 95 } as const;

describe('processChromaKey (magenta screen)', () => {
  it('clears the magenta background and keeps the green subject opaque', () => {
    const w = 40, h = 40, inset = 12;
    const data = makeMagentaWithGreenCenter(w, h, inset);
    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {});

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, w - 1, h - 1)).toBe(0);
    expect(alphaAt(data, w, w / 2, h / 2)).toBe(255);
  });

  it('keeps an interior magenta prop that is not edge-connected', () => {
    const w = 40, h = 40, inset = 8;
    const keyMax = fuzzPercentToKeyMax(35);
    const { r, g, b } = INTERIOR_MAGENTA_PROP_RGB;
    expect(isChromaLike(r, g, b, MAGENTA_KEY, 'key', keyMax)).toBe(true);
    expect(chromaDistanceToKey(r, g, b, MAGENTA_KEY)).toBeGreaterThanOrEqual(keyMax * 0.95);

    const data = makeMagentaWithGreenCenter(w, h, inset);
    const x0 = inset + 4;
    const y0 = inset + 4;
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = x0; x < x0 + 4; x++) paint(data, w, x, y, [r, g, b]);
    }
    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {});
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, x0 + 1, y0 + 1)).toBeGreaterThan(200);
  });

  it('non-guided certain-hole punches disconnected interior magenta', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeMagentaWithGreenCenter(w, h, inset);
    const px = inset + 6;
    const py = inset + 6;
    paint(data, w, px, py, [255, 0, 255]);
    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: false });
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, px, py)).toBeLessThanOrEqual(15);
  });

  it('guided: true does not certain-hole-punch a pure magenta interior pocket', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeMagentaWithGreenCenter(w, h, inset);
    const px = inset + 6;
    const py = inset + 6;
    paint(data, w, px, py, [255, 0, 255]);
    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: true });
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, px, py)).toBeGreaterThan(200);
  });

  it('erases a thin magenta spill spike near transparency', () => {
    // Magenta counterpart of the sticker-09 mark2 green spike: R and B both well
    // clear of G, balanced, distance ≫ keyMax so it survives the key untouched.
    const w = 40, h = 40, inset = 12;
    const data = makeMagentaWithGreenCenter(w, h, inset);
    const fx = inset;
    const fy = Math.floor(h / 2);
    paint(data, w, fx, fy, [150, 40, 145]);

    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: true });

    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, fx, fy)).toBe(0);
  });

  it('clamps balanced magenta cast near transparency to a neutral pixel', () => {
    // Pass 4c magenta: R and B a few levels above G survive despill; the wider
    // clamp ring pulls both dominant channels down so no pink halo remains.
    const w = 40, h = 40, inset = 12;
    const data = makeMagentaWithGreenCenter(w, h, inset);
    const fx = inset + 1;
    const fy = Math.floor(h / 2);
    paint(data, w, fx, fy, [100, 70, 95]);

    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: true });

    const i = (fy * w + fx) * 4;
    expect(data[i + 3]).toBeGreaterThan(200);
    expect(Math.min(data[i]!, data[i + 2]!) - data[i + 1]!).toBeLessThanOrEqual(1);
  });

  it('clears enclosed magenta pocket clusters in guided mode', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeMagentaWithGreenCenter(w, h, inset);
    for (let y = 14; y <= 16; y++) {
      for (let x = 14; x <= 16; x++) paint(data, w, x, y, [29, 13, 27]);
    }

    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: true });

    expect(alphaAt(data, w, 15, 15)).toBe(0);
    expect(alphaAt(data, w, inset + 5, inset + 5)).toBe(255);
  });
});

describe('magenta caption-ink guard', () => {
  const w = 40;
  const h = 40;
  const inset = 12;
  const fy = Math.floor(h / 2);

  /** Warm/cool inks that a magenta key would otherwise mistake for spill. */
  const INKS: ReadonlyArray<readonly [string, readonly number[]]> = [
    ['rose caption text', [200, 40, 120]],
    ['pale pink caption text', [240, 120, 150]],
    ['red lips', [200, 40, 50]],
    ['blush', [250, 180, 190]],
    ['violet hair', [120, 60, 190]],
  ];

  for (const [name, rgb] of INKS) {
    it(`keeps ${name} on the edge band instead of erasing it`, () => {
      const data = makeMagentaWithGreenCenter(w, h, inset);
      paint(data, w, inset, fy, rgb);
      processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: true });
      expect(alphaAt(data, w, 0, 0)).toBe(0);
      expect(alphaAt(data, w, inset, fy)).toBe(255);
    });
  }

  it('still erases the balanced magenta control pixel at the same spot', () => {
    const data = makeMagentaWithGreenCenter(w, h, inset);
    paint(data, w, inset, fy, [200, 40, 190]);
    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: true });
    expect(alphaAt(data, w, inset, fy)).toBe(0);
  });

  it('does not certain-hole-punch rose ink in the non-guided path', () => {
    const data = makeMagentaWithGreenCenter(w, h, 8);
    // Hot-pink text: inside the certain-hole distance band, but R − B = 45 marks
    // it as warm ink rather than key spill.
    paint(data, w, 14, 14, [220, 0, 175]);
    processChromaKey(data, w, h, MAGENTA_KEY, 35, () => {}, 2, 0.22, { guided: false });
    expect(alphaAt(data, w, 14, 14)).toBe(255);
  });
});

/**
 * Pass 3 reads pre-pass snapshots, so its neighbor-count decisions must not
 * depend on the low→high scan order. Rotating the input 180° and rotating the
 * result back must reproduce the un-rotated run exactly.
 */
describe('Pass 3 spike erasure is scan-order independent', () => {
  const W = 39; // odd, < 40 → seed strides are 1 so flood seeding is symmetric
  const H = 39;
  const INSET = 12;

  function rotate180(data: Uint8ClampedArray, w: number, h: number) {
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4;
        const t = ((h - 1 - y) * w + (w - 1 - x)) * 4;
        out[t] = data[s]!;
        out[t + 1] = data[s + 1]!;
        out[t + 2] = data[s + 2]!;
        out[t + 3] = data[s + 3]!;
      }
    }
    return out;
  }

  /** 4px diagonal spill spike hanging off the subject edge into the background. */
  function addDiagonalSpike(data: Uint8ClampedArray, rgb: readonly number[]) {
    for (let k = 0; k < 4; k++) paint(data, W, INSET - 1 - k, Math.floor(H / 2) - k, rgb);
  }

  function spikeAlphas(data: Uint8ClampedArray) {
    return [0, 1, 2, 3].map((k) =>
      alphaAt(data, W, INSET - 1 - k, Math.floor(H / 2) - k)
    );
  }

  const CASES = [
    { name: 'green', key: { r: 0, g: 255, b: 0 }, spike: [54, 148, 36], base: makeGreenWithRedCenter },
    { name: 'magenta', key: MAGENTA_KEY, spike: [150, 40, 145], base: makeMagentaWithGreenCenter },
  ] as const;

  for (const { name, key, spike, base } of CASES) {
    it(`${name}: 180° rotated input gives the 180° rotated output`, () => {
      const source = base(W, H, INSET);
      addDiagonalSpike(source, spike);

      const upright = new Uint8ClampedArray(source);
      processChromaKey(upright, W, H, key, 35, () => {}, 2, 0.22, { guided: true });

      const rotated = rotate180(source, W, H);
      processChromaKey(rotated, W, H, key, 35, () => {}, 2, 0.22, { guided: true });
      const restored = rotate180(rotated, W, H);

      expect(Array.from(restored)).toEqual(Array.from(upright));
    });

    it(`${name}: the spike's neighbor count actually discriminates`, () => {
      // Guards against a vacuous rotation test: the sparse ends of the diagonal
      // are erased while the two middle pixels keep >= 3 same-class neighbors.
      // Scan-order-dependent code would cascade and erase all four.
      const data = base(W, H, INSET);
      addDiagonalSpike(data, spike);
      processChromaKey(data, W, H, key, 35, () => {}, 2, 0.22, { guided: true });
      const alphas = spikeAlphas(data);
      expect(alphas.filter((a) => a === 0).length).toBeGreaterThan(0);
      expect(alphas.filter((a) => a! > 200).length).toBeGreaterThan(0);
    });
  }
});
