import { describe, expect, it } from 'vitest';
import {
  applyGeneratedListToJobImageState,
  createLineStickerJobImageState,
  flattenJobImageFrames,
  flattenJobImageGenerated,
} from './lineStickerJobImageState';

describe('lineStickerJobImageState', () => {
  it('round-trips generated sheet images through per-sheet job slots', () => {
    const next = applyGeneratedListToJobImageState(
      createLineStickerJobImageState(),
      ['a', null, 'c'],
    );
    expect(flattenJobImageGenerated(next)).toEqual(['a', null, 'c']);
    expect(next[2]?.generated).toBe('c');
    expect(flattenJobImageFrames(next)).toEqual([[], [], []]);
  });
});
