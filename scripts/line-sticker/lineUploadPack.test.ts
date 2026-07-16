import { describe, expect, it } from 'vitest';
import {
  pickRandomShopStickerIndices,
  resolveShopStickerIndices,
} from './lineUploadPack.mts';

describe('pickRandomShopStickerIndices', () => {
  it('returns the only sticker when count is 1', () => {
    expect(pickRandomShopStickerIndices(1)).toEqual({ mainIndex: 0, tabIndex: 0 });
  });

  it('picks two distinct indices for a 40-sticker set', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const { mainIndex, tabIndex } = pickRandomShopStickerIndices(40);
      expect(mainIndex).toBeGreaterThanOrEqual(0);
      expect(mainIndex).toBeLessThan(40);
      expect(tabIndex).toBeGreaterThanOrEqual(0);
      expect(tabIndex).toBeLessThan(40);
      expect(mainIndex).not.toBe(tabIndex);
    }
  });

  it('uses injected rng for deterministic picks', () => {
    const values = [0, 0, 0.5];
    const rng = () => values.shift() ?? 0;
    expect(pickRandomShopStickerIndices(40, rng)).toEqual({ mainIndex: 0, tabIndex: 20 });
  });
});

describe('resolveShopStickerIndices', () => {
  it('randomizes when indices are omitted', () => {
    const { mainIndex, tabIndex } = resolveShopStickerIndices(40, {});
    expect(mainIndex).not.toBe(tabIndex);
  });

  it('honors explicit 0-based overrides', () => {
    expect(
      resolveShopStickerIndices(40, { mainStickerIndex: 4, tabStickerIndex: 9 })
    ).toEqual({ mainIndex: 4, tabIndex: 9 });
  });
});
