import { describe, expect, it } from 'vitest';
import {
  rgbToYCbCr,
  chromaDistanceToKey,
  isChromaLike,
  CHROMA_LIKE_NORMALIZE_MAX,
  CHROMA_LIKE_KEY_MAX,
  CHROMA_LIKE_SOFT_EXTRA,
  fuzzPercentToKeyMax,
} from './chromaSimilarity';

const green = { r: 0, g: 255, b: 0 };
const magenta = { r: 255, g: 0, b: 255 };

describe('rgbToYCbCr', () => {
  it('maps pure green to high Y and green-ish chroma', () => {
    const { y, cb, cr } = rgbToYCbCr(0, 255, 0);
    expect(y).toBeGreaterThan(100);
    expect(cb).toBeLessThan(0);
    expect(cr).toBeLessThan(0);
  });
});

describe('chromaDistanceToKey', () => {
  it('is ~0 for the exact key color', () => {
    expect(chromaDistanceToKey(0, 255, 0, green)).toBeLessThan(1);
  });

  it('ignores brightness: dark green stays close to neon green key', () => {
    const d = chromaDistanceToKey(0, 120, 0, green);
    expect(d).toBeLessThan(CHROMA_LIKE_NORMALIZE_MAX);
  });
});

describe('isChromaLike', () => {
  it('accepts pure and AI-variant greens for normalize', () => {
    expect(isChromaLike(0, 255, 0, green, 'normalize')).toBe(true);
    expect(isChromaLike(0, 193, 64, green, 'normalize')).toBe(true);
    expect(isChromaLike(10, 180, 20, green, 'normalize')).toBe(true);
  });

  it('rejects skin, gray, and blue cloth', () => {
    expect(isChromaLike(255, 200, 180, green, 'normalize')).toBe(false);
    expect(isChromaLike(80, 60, 40, green, 'key')).toBe(false);
    expect(isChromaLike(40, 80, 200, green, 'key')).toBe(false);
  });

  it('accepts pure magenta and rejects blush-like red', () => {
    expect(isChromaLike(255, 0, 255, magenta, 'key')).toBe(true);
    expect(isChromaLike(220, 120, 130, magenta, 'key')).toBe(false);
  });

  it('uses a stricter key threshold than normalize for borderline greens', () => {
    expect(CHROMA_LIKE_KEY_MAX).toBeLessThan(CHROMA_LIKE_NORMALIZE_MAX);
    expect(CHROMA_LIKE_SOFT_EXTRA).toBe(12);
  });
});

describe('fuzzPercentToKeyMax', () => {
  it('maps 35% near the default key max band', () => {
    const mapped = fuzzPercentToKeyMax(35);
    expect(mapped).toBeGreaterThan(20);
    expect(mapped).toBeLessThan(80);
  });
});
