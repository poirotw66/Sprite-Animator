import { describe, it, expect } from 'vitest';
import { featherAlphaEdge } from './alphaEdgeFeather';

function makeAlphaMask(
  width: number,
  height: number,
  opaque: (x: number, y: number) => boolean
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const on = opaque(x, y);
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = on ? 255 : 0;
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe('featherAlphaEdge', () => {
  it('introduces partial alpha on the outer silhouette only', () => {
    const w = 7;
    const h = 5;
    const data = makeAlphaMask(w, h, (x, y) => y >= 1 && y <= 3 && x >= 2 && x <= 4);
    featherAlphaEdge(data, w, h);
    expect(alphaAt(data, w, 2, 1)).toBeGreaterThan(0);
    expect(alphaAt(data, w, 2, 1)).toBeLessThan(255);
    expect(alphaAt(data, w, 3, 2)).toBe(255);
  });

  it('keeps a large opaque interior at full alpha', () => {
    const w = 20;
    const h = 20;
    const data = makeAlphaMask(w, h, (x, y) => x >= 4 && x <= 15 && y >= 4 && y <= 15);
    featherAlphaEdge(data, w, h);
    expect(alphaAt(data, w, 10, 10)).toBe(255);
  });

  it('leaves fully transparent pixels transparent', () => {
    const w = 6;
    const h = 6;
    const data = makeAlphaMask(w, h, () => false);
    featherAlphaEdge(data, w, h);
    expect(alphaAt(data, w, 0, 0)).toBe(0);
  });

  it('preserves interior white stroke at full alpha', () => {
    const w = 9;
    const h = 9;
    const data = makeAlphaMask(w, h, (x, y) => x >= 2 && x <= 6 && y >= 2 && y <= 6);
    featherAlphaEdge(data, w, h);
    expect(alphaAt(data, w, 4, 4)).toBe(255);
    expect(alphaAt(data, w, 2, 4)).toBeLessThan(255);
  });
});
