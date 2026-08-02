import { describe, expect, it } from 'vitest';
import {
  BUNDLED_STICKER_FONT_BY_PRESET,
  isBundledStickerFontPresetKey,
} from './lineStickerBundledFontCatalog';

describe('lineStickerBundledFontCatalog', () => {
  it('maps four bundled presets to local TTF masters and browser WOFF2 copies', () => {
    expect(Object.keys(BUNDLED_STICKER_FONT_BY_PRESET)).toEqual([
      'liyushoushu',
      'fashionBitmap16',
      'kanaka',
      'naikai',
    ]);
    expect(BUNDLED_STICKER_FONT_BY_PRESET.liyushoushu.file).toBe('LiyuShoushu.ttf');
    expect(BUNDLED_STICKER_FONT_BY_PRESET.liyushoushu.browserFile).toBe('LiyuShoushu.woff2');
    expect(
      Object.values(BUNDLED_STICKER_FONT_BY_PRESET).map(({ browserFile }) => browserFile)
    ).toEqual([
      'LiyuShoushu.woff2',
      'FashionBitmap16_0.092.woff2',
      '073 TEGUSE - Kanaka Font_240705.woff2',
      'NaikaiFont-Regular-Lite.woff2',
    ]);
  });

  it('detects bundled preset keys', () => {
    expect(isBundledStickerFontPresetKey('kanaka')).toBe(true);
    expect(isBundledStickerFontPresetKey('round')).toBe(false);
  });
});
