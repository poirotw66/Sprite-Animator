import { describe, it, expect } from 'vitest';
import {
  isStickerStrokeFringe,
  isStickerStrokeWhite,
  shouldPreserveStickerStroke,
} from './stickerStrokeWhite';

describe('stickerStrokeWhite', () => {
  it('detects pure white stroke', () => {
    expect(isStickerStrokeWhite(255, 255, 255)).toBe(true);
    expect(isStickerStrokeWhite(245, 248, 245)).toBe(true);
  });

  it('detects JPEG green-tinted fringe', () => {
    expect(isStickerStrokeFringe(218, 247, 215)).toBe(true);
    expect(isStickerStrokeFringe(202, 243, 199)).toBe(true);
  });

  it('does not treat skin or strong green props as fringe', () => {
    expect(shouldPreserveStickerStroke(207, 171, 159)).toBe(false);
    expect(shouldPreserveStickerStroke(40, 200, 30)).toBe(false);
  });
});
