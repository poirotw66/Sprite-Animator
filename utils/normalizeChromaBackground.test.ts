import { describe, expect, it } from 'vitest';
import {
  CHROMA_BACKGROUND_NORMALIZE_TOLERANCE,
  isChromaBackgroundPixel,
  normalizeChromaBackgroundInPlace,
} from './normalizeChromaBackground';

describe('isChromaBackgroundPixel', () => {
  const greenTarget = { r: 0, g: 255, b: 0 };

  it('detects common AI green screen variants', () => {
    expect(isChromaBackgroundPixel(0, 193, 64, 'green', greenTarget)).toBe(true);
    expect(isChromaBackgroundPixel(10, 180, 20, 'green', greenTarget)).toBe(true);
  });

  it('does not flag typical character foreground pixels', () => {
    expect(isChromaBackgroundPixel(255, 200, 180, 'green', greenTarget)).toBe(false);
    expect(isChromaBackgroundPixel(80, 60, 40, 'green', greenTarget)).toBe(false);
  });
});

describe('normalizeChromaBackgroundInPlace', () => {
  it('rewrites green-like pixels to exact target and skips transparent pixels', () => {
    const data = new Uint8ClampedArray([
      0, 193, 64, 255,
      255, 200, 180, 255,
      0, 180, 0, 0,
    ]);
    const count = normalizeChromaBackgroundInPlace(
      data,
      'green',
      { r: 0, g: 255, b: 0 },
      CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
    );
    expect(count).toBe(1);
    expect(Array.from(data.slice(0, 4))).toEqual([0, 255, 0, 255]);
    expect(Array.from(data.slice(4, 8))).toEqual([255, 200, 180, 255]);
    expect(Array.from(data.slice(8, 12))).toEqual([0, 180, 0, 0]);
  });

  it('snaps dark green AI variant to exact target', () => {
    const data = new Uint8ClampedArray([0, 120, 0, 255, 255, 200, 180, 255]);
    const count = normalizeChromaBackgroundInPlace(
      data,
      'green',
      { r: 0, g: 255, b: 0 }
    );
    expect(count).toBe(1);
    expect(Array.from(data.slice(0, 4))).toEqual([0, 255, 0, 255]);
  });
});
