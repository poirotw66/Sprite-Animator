import { describe, it, expect } from 'vitest';
import { repairExteriorStrokeHalo } from './solidifyStrokeWhite';

function makeFrame(
  width: number,
  height: number,
  paint: (x: number, y: number, data: Uint8ClampedArray) => void
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) paint(x, y, data);
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe('repairExteriorStrokeHalo', () => {
  it('whitewashes exterior fringe but not interior shirt fill', () => {
    const w = 9;
    const h = 9;
    const data = makeFrame(w, h, (x, y, buf) => {
      const i = (y * w + x) * 4;
      const inSubject = x >= 2 && x <= 6 && y >= 2 && y <= 6;
      if (!inSubject) return;
      buf[i] = 220;
      buf[i + 1] = 245;
      buf[i + 2] = 218;
      buf[i + 3] = 255;
    });
    repairExteriorStrokeHalo(data, w, h, 0);
    expect(alphaAt(data, w, 4, 4)).toBe(255);
    expect(data[(4 * w + 4) * 4]).toBe(220);
    expect(alphaAt(data, w, 2, 4)).toBe(255);
    expect(data[(4 * w + 2) * 4]).toBe(255);
  });
});
