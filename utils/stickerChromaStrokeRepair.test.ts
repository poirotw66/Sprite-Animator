import { describe, it, expect } from 'vitest';
import { repairStickerStrokeAfterChromaKey } from './stickerChromaStrokeRepair';

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe('repairStickerStrokeAfterChromaKey', () => {
  it('restores cleared green-tinted fringe on the exterior stroke ring', () => {
    const w = 9;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let x = 1; x <= 7; x++) {
      for (const y of [1, 3]) {
        const i = (y * w + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    const gap = (2 * w + 4) * 4;
    data[gap] = 218;
    data[gap + 1] = 247;
    data[gap + 2] = 215;
    data[gap + 3] = 0;

    repairStickerStrokeAfterChromaKey(data, w, h);
    expect(alphaAt(data, w, 4, 2)).toBe(255);
    expect(data[gap]).toBe(255);
  });

  it('keeps exterior stroke fully opaque (no alpha feather)', () => {
    const w = 11;
    const h = 11;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 3; y <= 7; y++) {
      for (let x = 3; x <= 7; x++) {
        const i = (y * w + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    repairStickerStrokeAfterChromaKey(data, w, h);
    expect(alphaAt(data, w, 5, 5)).toBe(255);
    expect(alphaAt(data, w, 3, 5)).toBe(255);
  });

  it('does not bleach interior off-white fill', () => {
    const w = 9;
    const h = 9;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) {
        const i = (y * w + x) * 4;
        data[i] = 245;
        data[i + 1] = 248;
        data[i + 2] = 242;
        data[i + 3] = 255;
      }
    }
    for (let x = 1; x <= 7; x++) {
      for (const y of [1, 7]) {
        const i = (y * w + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    repairStickerStrokeAfterChromaKey(data, w, h);
    const center = (4 * w + 4) * 4;
    expect(data[center]).toBe(245);
    expect(data[center + 1]).toBe(248);
    expect(data[center + 2]).toBe(242);
  });
});
