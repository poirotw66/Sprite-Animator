import { describe, expect, it } from 'vitest';
import {
  BUNDLED_STICKER_FONT_BY_PRESET,
  isBundledStickerFontPresetKey,
} from './lineStickerBundledFontCatalog';

describe('lineStickerBundledFontCatalog', () => {
  it('maps four bundled presets to font files', () => {
    expect(Object.keys(BUNDLED_STICKER_FONT_BY_PRESET)).toEqual([
      'liyushoushu',
      'fashionBitmap16',
      'kanaka',
      'naikai',
    ]);
    expect(BUNDLED_STICKER_FONT_BY_PRESET.liyushoushu.file).toBe('LiyuShoushu.ttf');
  });

  it('detects bundled preset keys', () => {
    expect(isBundledStickerFontPresetKey('kanaka')).toBe(true);
    expect(isBundledStickerFontPresetKey('round')).toBe(false);
  });
});
