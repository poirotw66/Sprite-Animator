import { describe, it, expect } from 'vitest';
import { clearEdgeConnectedResidue } from './frameEdgeCleanup';

/** Build an RGBA buffer; `opaque(x,y)` decides alpha (255 vs 0), rgb = white. */
function makeData(
  width: number,
  height: number,
  opaque: (x: number, y: number) => boolean
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = opaque(x, y) ? 255 : 0;
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe('clearEdgeConnectedResidue', () => {
  it('clears a thin opaque line along the top edge', () => {
    const w = 6, h = 6;
    const data = makeData(w, h, (_x, y) => y === 0); // 1px top line
    const cleared = clearEdgeConnectedResidue(data, w, h, { maxDepthPx: 4 });
    expect(cleared).toBe(6);
    for (let x = 0; x < w; x++) expect(alphaAt(data, w, x, 0)).toBe(0);
  });

  it('preserves a centered subject not touching any edge', () => {
    const w = 8, h = 8;
    // 2x2 opaque block at center, transparent gap to all edges
    const data = makeData(w, h, (x, y) => x >= 3 && x <= 4 && y >= 3 && y <= 4);
    const cleared = clearEdgeConnectedResidue(data, w, h, { maxDepthPx: 4 });
    expect(cleared).toBe(0);
    expect(alphaAt(data, w, 3, 3)).toBe(255);
    expect(alphaAt(data, w, 4, 4)).toBe(255);
  });

  it('bounds erosion depth so a deep opaque region keeps its core', () => {
    const w = 10, h = 10;
    const data = makeData(w, h, () => true); // fully opaque
    clearEdgeConnectedResidue(data, w, h, { maxDepthPx: 2 });
    // Outer ring eroded, center core intact.
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, 5, 5)).toBe(255);
  });

  it('treats near-transparent pixels as background (does not erase them)', () => {
    const w = 5, h = 5;
    const data = makeData(w, h, () => false); // all transparent
    const cleared = clearEdgeConnectedResidue(data, w, h, { maxDepthPx: 3, alphaThreshold: 24 });
    expect(cleared).toBe(0);
  });
});
