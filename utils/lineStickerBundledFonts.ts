/**
 * Register repo-bundled fonts for headless @napi-rs/canvas rendering.
 * Browser preview lazy-loads the same files via lineStickerBrowserFonts.ts.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';
import { BUNDLED_STICKER_FONT_BY_PRESET } from './lineStickerBundledFontCatalog';

export {
  LIYU_SHOUSHU_FAMILY,
  FASHION_BITMAP16_FAMILY,
  KANAKA_FONT_FAMILY,
  NAIKAI_FONT_FAMILY,
} from './lineStickerBundledFontCatalog';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let bundledFontsRegistered = false;

/** Idempotent; skips missing files (e.g. partial checkout). */
export function ensureBundledStickerFontsRegistered(): void {
  if (bundledFontsRegistered) {
    return;
  }
  for (const { file, family } of Object.values(BUNDLED_STICKER_FONT_BY_PRESET)) {
    const fontPath = join(PROJECT_ROOT, 'fonts', file);
    if (existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, family);
    }
  }
  bundledFontsRegistered = true;
}
