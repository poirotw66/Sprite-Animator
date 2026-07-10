import { describe, it, expect } from 'vitest';
import { scaleRgbaNearest, scaleRgbaBoxDown } from './rgbaScale';

describe('rgbaScale', () => {
  it('nearest upscale duplicates pixels', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const up = scaleRgbaNearest({ data, width: 2, height: 1 }, 2);
    expect(up.width).toBe(4);
    expect(up.data[0]).toBe(255);
    expect(up.data[8]).toBe(0);
    expect(up.data[9]).toBe(255);
  });

  it('box downscale averages premultiplied alpha', () => {
    const data = new Uint8ClampedArray(4 * 4);
    data[0] = 255;
    data[3] = 255;
    data[12] = 255;
    data[15] = 255;
    const down = scaleRgbaBoxDown({ data, width: 2, height: 2 }, 2);
    expect(down.width).toBe(1);
    expect(down.data[3]).toBe(128);
    expect(down.data[0]).toBe(255);
  });
});
