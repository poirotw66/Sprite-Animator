import { describe, expect, it } from 'vitest';
import { buildEqualGridBounds } from './sliceSpriteSheetByOwnership';
import { sliceSheetByComponentOwnership } from './sheetComponentSlicer';

describe('buildEqualGridBounds', () => {
  it('builds equal 5x4 cell boundaries on a 500x400 sheet', () => {
    const { xBounds, yBounds } = buildEqualGridBounds(500, 400, 5, 4, 0, 0, 0, 0);
    expect(xBounds).toEqual([0, 100, 200, 300, 400, 500]);
    expect(yBounds).toEqual([0, 100, 200, 300, 400]);
  });

  it('honors padding and shift when laying out ownership grids', () => {
    const { xBounds, yBounds } = buildEqualGridBounds(200, 200, 2, 2, 10, 20, 2, 4);
    expect(xBounds[0]).toBe(12); // left 10 + shiftX 2
    expect(yBounds[0]).toBe(24); // top 20 + shiftY 4
    expect(xBounds.at(-1)).toBe(12 + (200 - 20));
    expect(yBounds.at(-1)).toBe(24 + (200 - 40));
  });
});

describe('ownership grid + cross-cell bleed (frontend path core)', () => {
  it('keeps overflowing art with the owner cell', () => {
    const width = 200;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    // Left-cell cat body + tail into right cell
    for (let y = 20; y < 80; y++) {
      for (let x = 30; x < 120; x++) {
        const i = (y * width + x) * 4;
        data[i] = 80;
        data[i + 1] = 60;
        data[i + 2] = 40;
        data[i + 3] = 255;
      }
    }
    const { xBounds, yBounds } = buildEqualGridBounds(width, height, 2, 1, 0, 0, 0, 0);
    const frames = sliceSheetByComponentOwnership(data, width, height, xBounds, yBounds);
    expect(frames).toHaveLength(2);
    // Right cell should not keep the spilled tail (owner is left)
    const right = frames[1]!;
    let opaque = 0;
    for (let i = 3; i < right.data.length; i += 4) {
      if (right.data[i]! > 128) opaque++;
    }
    expect(opaque).toBe(0);
    expect(frames[0]!.width).toBeGreaterThan(100);
  });
});
