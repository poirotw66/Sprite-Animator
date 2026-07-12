/**
 * Lazy-load repo-bundled sticker fonts in the browser via FontFace API.
 * Headless scripts use ensureBundledStickerFontsRegistered() instead.
 */

import {
  BUNDLED_STICKER_FONT_BY_PRESET,
  isBundledStickerFontPresetKey,
  type BundledStickerFontPresetKey,
} from './lineStickerBundledFontCatalog';
import type { LineStickerFontKey } from './lineStickerPresets';

const FONT_URL_BY_PRESET: Record<BundledStickerFontPresetKey, string> = {
  liyushoushu: new URL('../fonts/LiyuShoushu.ttf', import.meta.url).href,
  fashionBitmap16: new URL('../fonts/FashionBitmap16_0.092.ttf', import.meta.url).href,
  kanaka: new URL('../fonts/073 TEGUSE - Kanaka Font_240705.ttf', import.meta.url).href,
  naikai: new URL('../fonts/NaikaiFont-Regular-Lite.ttf', import.meta.url).href,
};

const loadedFamilies = new Set<string>();
const loadingByFamily = new Map<string, Promise<void>>();

async function loadBundledFont(presetKey: BundledStickerFontPresetKey): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  const { family } = BUNDLED_STICKER_FONT_BY_PRESET[presetKey];
  if (loadedFamilies.has(family)) {
    return;
  }

  const pending = loadingByFamily.get(family);
  if (pending) {
    await pending;
    return;
  }

  const loadPromise = (async () => {
    const url = FONT_URL_BY_PRESET[presetKey];
    const face = new FontFace(family, `url("${url}")`, {
      style: 'normal',
      weight: '400',
      display: 'swap',
    });
    await face.load();
    document.fonts.add(face);
    loadedFamilies.add(family);
  })();

  loadingByFamily.set(family, loadPromise);
  try {
    await loadPromise;
  } finally {
    loadingByFamily.delete(family);
  }
}

/** Idempotent; no-op for presets that use system fonts only. */
export async function ensureBundledStickerFontForPreset(fontKey: LineStickerFontKey): Promise<void> {
  if (!isBundledStickerFontPresetKey(fontKey)) {
    return;
  }
  await loadBundledFont(fontKey);
}
