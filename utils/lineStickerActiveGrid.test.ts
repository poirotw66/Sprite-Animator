import { describe, expect, it } from 'vitest';
import { getLineStickerActiveGrid } from './lineStickerActiveGrid';

describe('getLineStickerActiveGrid', () => {
  it('follows viewer slice changes in one-sheet mode', () => {
    expect(getLineStickerActiveGrid(false, { cols: 3, rows: 5 })).toEqual({ cols: 3, rows: 5 });
  });

  it('locks a LINE sticker set to its required 4 × 4 sheet grid', () => {
    expect(getLineStickerActiveGrid(true, { cols: 3, rows: 5 })).toEqual({ cols: 4, rows: 4 });
  });
});
