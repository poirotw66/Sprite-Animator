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

/**
 * The glob remains empty in a clean checkout where the local font vault is
 * intentionally absent. That keeps the browser on its existing CJK fallback
 * stack without Vite emitting a broken TTF URL.
 */
const browserFontUrls = import.meta.glob('../fonts/*.woff2', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const loadedFamilies = new Set<string>();
const loadingByFamily = new Map<string, Promise<void>>();
const unavailableFamilies = new Set<string>();

function browserFontUrlForPreset(presetKey: BundledStickerFontPresetKey): string | undefined {
  const { browserFile } = BUNDLED_STICKER_FONT_BY_PRESET[presetKey];
  return browserFontUrls[`../fonts/${browserFile}`];
}

async function loadBundledFont(presetKey: BundledStickerFontPresetKey): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  const { family } = BUNDLED_STICKER_FONT_BY_PRESET[presetKey];
  if (loadedFamilies.has(family) || unavailableFamilies.has(family)) {
    return;
  }

  const pending = loadingByFamily.get(family);
  if (pending) {
    await pending;
    return;
  }

  const loadPromise = (async () => {
    const url = browserFontUrlForPreset(presetKey);
    if (!url || typeof FontFace === 'undefined') {
      unavailableFamilies.add(family);
      return;
    }

    try {
      const face = new FontFace(family, `url("${url}") format("woff2")`, {
        style: 'normal',
        weight: '400',
        display: 'swap',
      });
      await face.load();
      document.fonts.add(face);
      loadedFamilies.add(family);
    } catch {
      // The CSS stack already contains CJK-capable system fallbacks. Do not turn
      // an optional display font into a failed sticker render or repeat the request.
      unavailableFamilies.add(family);
    }
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
