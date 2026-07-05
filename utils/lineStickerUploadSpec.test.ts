import { describe, expect, it } from 'vitest';
import {
  computeFitDimensions,
  resolveLineUploadStickerCount,
  toEvenDimension,
} from './lineStickerUploadSpec';

describe('toEvenDimension', () => {
  it('rounds to the nearest even number at least 2', () => {
    expect(toEvenDimension(241)).toBe(240);
    expect(toEvenDimension(3)).toBe(2);
    expect(toEvenDimension(370)).toBe(370);
  });
});

describe('computeFitDimensions', () => {
  it('scales down oversized frames to fit LINE max box', () => {
    expect(computeFitDimensions(512, 512, 370, 320)).toEqual({
      width: 320,
      height: 320,
    });
  });

  it('keeps small frames unchanged when already within limits', () => {
    expect(computeFitDimensions(240, 240, 370, 320)).toEqual({
      width: 240,
      height: 240,
    });
  });
});

describe('resolveLineUploadStickerCount', () => {
  it('defaults oversized production to 40 stickers', () => {
    expect(resolveLineUploadStickerCount(48)).toBe(40);
  });

  it('accepts explicit supported counts', () => {
    expect(resolveLineUploadStickerCount(40, 40)).toBe(40);
  });
});
