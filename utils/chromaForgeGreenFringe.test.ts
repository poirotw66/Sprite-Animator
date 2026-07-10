import { describe, expect, it } from 'vitest';
import { despillForgeGreenFringe } from './chromaForgeGreenFringe';

describe('despillForgeGreenFringe', () => {
  it('removes green tint from white edge pixels beside transparency', () => {
    const w = 4;
    const h = 3;
    const data = new Uint8ClampedArray(w * h * 4);
    const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    };

    set(0, 1, 0, 255, 0, 0);
    set(1, 1, 245, 255, 245, 255);
    set(2, 1, 245, 255, 245, 255);
    set(3, 1, 0, 255, 0, 0);

    despillForgeGreenFringe(data, w, h);

    expect(data[(1 * w + 1) * 4 + 1]).toBe(245);
    expect(data[(1 * w + 2) * 4 + 1]).toBe(245);
  });

  it('does not change interior opaque green subject pixels', () => {
    const w = 5;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      data[i] = 40;
      data[i + 1] = 180;
      data[i + 2] = 50;
      data[i + 3] = 255;
    }

    despillForgeGreenFringe(data, w, h);

    const center = (2 * w + 2) * 4 + 1;
    expect(data[center]).toBe(180);
  });

  it('erases isolated green specks beside the subject edge', () => {
    const w = 5;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    };

    set(0, 2, 0, 0, 0, 0);
    set(1, 2, 0, 255, 0, 255);
    set(2, 2, 220, 220, 220, 255);
    set(3, 2, 220, 220, 220, 255);
    set(4, 2, 0, 0, 0, 0);

    despillForgeGreenFringe(data, w, h);

    expect(data[(2 * w + 1) * 4 + 3]).toBe(0);
    expect(data[(2 * w + 2) * 4 + 3]).toBe(255);
  });
});
