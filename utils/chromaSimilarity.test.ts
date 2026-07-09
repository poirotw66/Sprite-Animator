import { describe, expect, it } from 'vitest';
import {
  rgbToYCbCr,
  chromaDistanceToKey,
  isChromaLike,
  isChromaSoftEdge,
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

  it('distance alone separates skin from green key (above key max)', () => {
    const d = chromaDistanceToKey(255, 200, 180, green);
    expect(d).toBeGreaterThan(CHROMA_LIKE_KEY_MAX);
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

  it('treats dark green as chroma-like at both thresholds (brightness invariance)', () => {
    expect(isChromaLike(0, 120, 0, green, 'normalize')).toBe(true);
    expect(isChromaLike(0, 120, 0, green, 'key')).toBe(true);
  });

  it('passes normalize but fails key for borderline AI greens (dual threshold)', () => {
    const r = 10;
    const g = 66;
    const b = 20;
    const d = chromaDistanceToKey(r, g, b, green);
    expect(d).toBeGreaterThan(CHROMA_LIKE_KEY_MAX);
    expect(d).toBeLessThanOrEqual(CHROMA_LIKE_NORMALIZE_MAX);
    expect(isChromaLike(r, g, b, green, 'normalize')).toBe(true);
    expect(isChromaLike(r, g, b, green, 'key')).toBe(false);
    expect(isChromaLike(r, g, b, green, 'key', CHROMA_LIKE_NORMALIZE_MAX)).toBe(true);
  });
});

describe('isChromaSoftEdge', () => {
  it('accepts green-ish pixels just outside key max within the soft band', () => {
    const r = 10;
    const g = 66;
    const b = 20;
    const d = chromaDistanceToKey(r, g, b, green);
    expect(d).toBeGreaterThan(CHROMA_LIKE_KEY_MAX);
    expect(d).toBeLessThanOrEqual(CHROMA_LIKE_KEY_MAX + CHROMA_LIKE_SOFT_EXTRA);
    expect(isChromaLike(r, g, b, green, 'key')).toBe(false);
    expect(isChromaSoftEdge(r, g, b, green)).toBe(true);
  });

  it('rejects skin even when distance might be ambiguous', () => {
    expect(isChromaSoftEdge(255, 200, 180, green)).toBe(false);
  });
});

describe('fuzzPercentToKeyMax', () => {
  it('maps 35% exactly to the default key max', () => {
    expect(fuzzPercentToKeyMax(35)).toBe(CHROMA_LIKE_KEY_MAX);
  });
});
