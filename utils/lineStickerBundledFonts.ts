/**
 * Register repo-bundled fonts for headless @napi-rs/canvas rendering.
 * Browser preview uses the same family names via @font-face in index.css.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

/** PostScript / CSS family name inside fonts/LiyuShoushu.ttf */
export const LIYU_SHOUSHU_FAMILY = 'Liyu Shoushu';

/** PostScript / CSS family name inside fonts/FashionBitmap16_0.092.ttf */
export const FASHION_BITMAP16_FAMILY = 'FashionBitmap16';

/** PostScript / CSS family name inside fonts/073 TEGUSE - Kanaka Font_240705.ttf */
export const KANAKA_FONT_FAMILY = '073 TEGUSE  Kanaka Font';

/** PostScript / CSS family name inside fonts/NaikaiFont-Regular-Lite.ttf */
export const NAIKAI_FONT_FAMILY = 'NaikaiFont';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const KANAKA_FONT_FILE = '073 TEGUSE - Kanaka Font_240705.ttf';

const BUNDLED_STICKER_FONT_FILES: ReadonlyArray<{ file: string; family: string }> = [
  { file: 'LiyuShoushu.ttf', family: LIYU_SHOUSHU_FAMILY },
  { file: 'FashionBitmap16_0.092.ttf', family: FASHION_BITMAP16_FAMILY },
  { file: KANAKA_FONT_FILE, family: KANAKA_FONT_FAMILY },
  { file: 'NaikaiFont-Regular-Lite.ttf', family: NAIKAI_FONT_FAMILY },
];

let bundledFontsRegistered = false;

/** Idempotent; skips missing files (e.g. partial checkout). */
export function ensureBundledStickerFontsRegistered(): void {
  if (bundledFontsRegistered) {
    return;
  }
  for (const { file, family } of BUNDLED_STICKER_FONT_FILES) {
    const fontPath = join(PROJECT_ROOT, 'fonts', file);
    if (existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, family);
    }
  }
  bundledFontsRegistered = true;
}
