/** PostScript / CSS family name inside fonts/LiyuShoushu.ttf */
export const LIYU_SHOUSHU_FAMILY = 'Liyu Shoushu';

/** PostScript / CSS family name inside fonts/FashionBitmap16_0.092.ttf */
export const FASHION_BITMAP16_FAMILY = 'FashionBitmap16';

/** PostScript / CSS family name inside fonts/073 TEGUSE - Kanaka Font_240705.ttf */
export const KANAKA_FONT_FAMILY = '073 TEGUSE  Kanaka Font';

/** PostScript / CSS family name inside fonts/NaikaiFont-Regular-Lite.ttf */
export const NAIKAI_FONT_FAMILY = 'NaikaiFont';

export const BUNDLED_STICKER_FONT_BY_PRESET = {
  liyushoushu: { family: LIYU_SHOUSHU_FAMILY, file: 'LiyuShoushu.ttf' },
  fashionBitmap16: { family: FASHION_BITMAP16_FAMILY, file: 'FashionBitmap16_0.092.ttf' },
  kanaka: { family: KANAKA_FONT_FAMILY, file: '073 TEGUSE - Kanaka Font_240705.ttf' },
  naikai: { family: NAIKAI_FONT_FAMILY, file: 'NaikaiFont-Regular-Lite.ttf' },
} as const;

export type BundledStickerFontPresetKey = keyof typeof BUNDLED_STICKER_FONT_BY_PRESET;

export function isBundledStickerFontPresetKey(
  fontKey: string
): fontKey is BundledStickerFontPresetKey {
  return fontKey in BUNDLED_STICKER_FONT_BY_PRESET;
}
