import { describe, expect, it } from 'vitest';
import {
  addExteriorWhiteStroke,
  cleanPaperBackgroundMatte,
  clearDetachedNeutralPaperCrumbs,
  clearDetachedTinyArtifacts,
  peelNeutralPaperHalo,
} from './paperBackgroundMatte';

function frame(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgba: [number, number, number, number]
): void {
  data.set(rgba, (y * width + x) * 4);
}

function alphaAt(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  return data[(y * width + x) * 4 + 3]!;
}

describe('paperBackgroundMatte', () => {
  it('peels a paper-white shell outside dark ink', () => {
    const width = 9;
    const data = frame(width, 9);
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) setPixel(data, width, x, y, [250, 250, 250, 255]);
    }
    for (let y = 3; y <= 5; y++) {
      for (let x = 3; x <= 5; x++) setPixel(data, width, x, y, [20, 20, 20, 255]);
    }

    const cleared = peelNeutralPaperHalo(data, width, 9, 1);
    expect(cleared).toBeGreaterThan(0);
    expect(alphaAt(data, width, 2, 2)).toBe(0);
    expect(alphaAt(data, width, 4, 4)).toBe(255);
  });

  it('keeps broad white foreground without nearby ink', () => {
    const width = 12;
    const data = frame(width, 12);
    for (let y = 2; y <= 9; y++) {
      for (let x = 2; x <= 9; x++) setPixel(data, width, x, y, [252, 252, 252, 255]);
    }
    expect(peelNeutralPaperHalo(data, width, 12, 2)).toBe(0);
    expect(alphaAt(data, width, 2, 2)).toBe(255);
  });

  it('clears tiny white crumbs but preserves dark punctuation', () => {
    const width = 10;
    const data = frame(width, 10);
    setPixel(data, width, 1, 1, [250, 250, 250, 255]);
    setPixel(data, width, 8, 8, [10, 10, 10, 255]);
    expect(clearDetachedNeutralPaperCrumbs(data, width, 10, 8)).toBe(1);
    expect(alphaAt(data, width, 1, 1)).toBe(0);
    expect(alphaAt(data, width, 8, 8)).toBe(255);
  });

  it('creates partial alpha on the cleaned exterior edge', () => {
    const width = 9;
    const data = frame(width, 9);
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) setPixel(data, width, x, y, [245, 245, 245, 255]);
    }
    cleanPaperBackgroundMatte(data, width, 9);
    expect(alphaAt(data, width, 2, 2)).toBeGreaterThan(0);
    expect(alphaAt(data, width, 2, 2)).toBeLessThan(255);
    expect(alphaAt(data, width, 4, 4)).toBe(255);
  });

  it('keeps thin dark ink opaque after feathering', () => {
    const width = 9;
    const data = frame(width, 9);
    for (let x = 2; x <= 6; x++) setPixel(data, width, x, 4, [20, 20, 20, 255]);
    cleanPaperBackgroundMatte(data, width, 9);
    expect(alphaAt(data, width, 4, 4)).toBe(255);
  });

  it('rebuilds a continuous exterior white stroke without filling enclosed holes', () => {
    const width = 11;
    const data = frame(width, 11);
    for (let y = 3; y <= 7; y++) {
      for (let x = 3; x <= 7; x++) {
        if (x === 5 && y === 5) continue;
        setPixel(data, width, x, y, [20, 20, 20, 255]);
      }
    }
    expect(addExteriorWhiteStroke(data, width, 11, 1)).toBeGreaterThan(0);
    const outer = (5 * width + 2) * 4;
    expect(Array.from(data.slice(outer, outer + 4))).toEqual([255, 255, 255, 255]);
    expect(alphaAt(data, width, 5, 5)).toBe(0);
  });

  it('clears only microscopic detached artifacts', () => {
    const width = 10;
    const data = frame(width, 10);
    setPixel(data, width, 1, 1, [20, 20, 20, 255]);
    for (let x = 5; x <= 7; x++) setPixel(data, width, x, 7, [20, 20, 20, 255]);
    expect(clearDetachedTinyArtifacts(data, width, 10, 2)).toBe(1);
    expect(alphaAt(data, width, 1, 1)).toBe(0);
    expect(alphaAt(data, width, 6, 7)).toBe(255);
  });
});
