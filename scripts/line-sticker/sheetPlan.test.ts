import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LINE_STICKER_SET_COUNT,
  resolveSetLayout,
  splitPhrasesAcrossSheets,
  totalFramesFromLayouts,
} from './sheetPlan.ts';

describe('resolveSetLayout', () => {
  it('returns two 4x5 sheets for LINE standard 40-sticker set', () => {
    expect(resolveSetLayout(40)).toEqual([
      { cols: 4, rows: 5 },
      { cols: 4, rows: 5 },
    ]);
  });

  it('returns three 4x4 sheets for legacy 48-sticker set', () => {
    expect(resolveSetLayout(48)).toEqual([
      { cols: 4, rows: 4 },
      { cols: 4, rows: 4 },
      { cols: 4, rows: 4 },
    ]);
  });

  it('throws for unsupported sticker counts', () => {
    expect(() => resolveSetLayout(32)).toThrow(/Unsupported stickerCount/);
  });
});

describe('splitPhrasesAcrossSheets', () => {
  it('splits 40 phrases across two 4x5 sheets', () => {
    const phrases = Array.from({ length: 40 }, (_, index) => `p${index + 1}`);
    const layouts = resolveSetLayout(40);
    const slices = splitPhrasesAcrossSheets(phrases, layouts);

    expect(slices).toHaveLength(2);
    expect(slices[0]).toHaveLength(20);
    expect(slices[1]).toHaveLength(20);
    expect(slices[0][0]).toBe('p1');
    expect(slices[0][19]).toBe('p20');
    expect(slices[1][0]).toBe('p21');
    expect(slices[1][19]).toBe('p40');
  });
});

describe('totalFramesFromLayouts', () => {
  it('counts 40 frames for the default LINE set layout', () => {
    expect(totalFramesFromLayouts(resolveSetLayout(DEFAULT_LINE_STICKER_SET_COUNT))).toBe(40);
  });
});
