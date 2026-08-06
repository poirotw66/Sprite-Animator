/**
 * Chroma-key output regression lock (green).
 *
 * Green output must stay bit-for-bit identical across refactors that claim to be
 * behaviour-preserving, so hash a battery of runs — plain background, hard-case
 * spill colors, caption ink, noise — and compare against digests captured from
 * the implementation before the separable-dilation rewrite.
 *
 * If a digest here changes, behaviour changed. That is a bug unless the change
 * was deliberate and the new digests were re-captured on purpose.
 */
import { describe, expect, it } from 'vitest';
import { processChromaKey } from './chromaKeyCore';

const GREEN_KEY = { r: 0, g: 255, b: 0 };

/** FNV-1a over the whole RGBA buffer — any single-channel drift changes the digest. */
function hashRgba(data: Uint8ClampedArray): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Deterministic LCG so fixtures never depend on Math.random. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function fillGreenBackdrop(data: Uint8ClampedArray, w: number, h: number, inset: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= inset && x < w - inset && y >= inset && y < h - inset;
      data[i] = inside ? 220 : 0;
      data[i + 1] = inside ? 30 : 255;
      data[i + 2] = inside ? 40 : 0;
      data[i + 3] = 255;
    }
  }
}

function put(data: Uint8ClampedArray, w: number, x: number, y: number, rgb: readonly number[]) {
  const i = (y * w + x) * 4;
  data[i] = rgb[0]!;
  data[i + 1] = rgb[1]!;
  data[i + 2] = rgb[2]!;
  data[i + 3] = 255;
}

/** Plain green backdrop + red subject. */
function plainFixture(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  fillGreenBackdrop(data, w, h, 12);
  return data;
}

/** Every green hard case the tuned heuristics touch, one pixel each. */
function hardCaseFixture(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  fillGreenBackdrop(data, w, h, 12);
  const cases: ReadonlyArray<readonly [number, number, readonly number[]]> = [
    [12, 20, [47, 158, 30]], // muted olive fringe failing YCbCr key
    [13, 22, [53, 81, 32]], // borderline spill just inside the mass
    [12, 24, [54, 148, 36]], // sticker-09 mark2 spike
    [14, 26, [56, 59, 49]], // yellow-green olive hair AA
    [12, 28, [251, 255, 240]], // near-white yellow-green edge tint
    [16, 16, [30, 190, 180]], // cyan/teal caption ink
    [18, 18, [40, 120, 110]], // dim mint caption ink
    [20, 20, [66, 66, 64]], // neutral dark ink
    [22, 22, [19, 29, 13]], // enclosed pocket residue
    [23, 22, [19, 29, 13]],
    [22, 23, [19, 29, 13]],
    [23, 23, [19, 29, 13]],
    [26, 26, [20, 100, 23]], // intentional interior green prop
    [27, 26, [20, 100, 23]],
    [26, 27, [20, 100, 23]],
    [27, 27, [20, 100, 23]],
  ];
  for (const [x, y, rgb] of cases) put(data, w, x, y, rgb);
  return data;
}

/** Noisy subject with a green spill ramp along its left edge. */
function noiseFixture(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  const rand = lcg(0x5eed1234);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= 10 && x < w - 10 && y >= 10 && y < h - 10;
      if (!inside) {
        data[i] = Math.round(rand() * 20);
        data[i + 1] = 235 + Math.round(rand() * 20);
        data[i + 2] = Math.round(rand() * 20);
      } else {
        const ramp = Math.max(0, 1 - (x - 10) / 6);
        data[i] = Math.round(150 * (1 - ramp) + 40 * ramp + rand() * 12);
        data[i + 1] = Math.round(120 * (1 - ramp) + 170 * ramp + rand() * 12);
        data[i + 2] = Math.round(130 * (1 - ramp) + 35 * ramp + rand() * 12);
      }
      data[i + 3] = 255;
    }
  }
  return data;
}

interface ParityCase {
  name: string;
  digest: string;
  run: () => Uint8ClampedArray;
}

const W = 48;
const H = 48;

const CASES: readonly ParityCase[] = [
  {
    name: 'plain / non-guided',
    digest: '27729cc5',
    run: () => {
      const data = plainFixture(W, H);
      processChromaKey(data, W, H, GREEN_KEY, 35, () => {}, 2, 0.22, { guided: false });
      return data;
    },
  },
  {
    name: 'plain / guided',
    digest: '27729cc5',
    run: () => {
      const data = plainFixture(W, H);
      processChromaKey(data, W, H, GREEN_KEY, 35, () => {}, 2, 0.22, { guided: true });
      return data;
    },
  },
  {
    name: 'hard cases / guided',
    digest: '63860b08',
    run: () => {
      const data = hardCaseFixture(W, H);
      processChromaKey(data, W, H, GREEN_KEY, 35, () => {}, 2, 0.22, { guided: true });
      return data;
    },
  },
  {
    name: 'hard cases / non-guided',
    digest: 'd69d1ef0',
    run: () => {
      const data = hardCaseFixture(W, H);
      processChromaKey(data, W, H, GREEN_KEY, 35, () => {}, 2, 0.22, { guided: false });
      return data;
    },
  },
  {
    name: 'noise ramp / guided',
    digest: '338aaf81',
    run: () => {
      const data = noiseFixture(W, H);
      processChromaKey(data, W, H, GREEN_KEY, 35, () => {}, 2, 0.22, { guided: true });
      return data;
    },
  },
  {
    name: 'noise ramp / non-guided, wide band',
    digest: '2cac8bd3',
    run: () => {
      const data = noiseFixture(W, H);
      processChromaKey(data, W, H, GREEN_KEY, 45, () => {}, 3, 0.35, { guided: false });
      return data;
    },
  },
];

describe('green output parity', () => {
  for (const c of CASES) {
    it(`is unchanged for ${c.name}`, () => {
      expect(hashRgba(c.run())).toBe(c.digest);
    });
  }
});
