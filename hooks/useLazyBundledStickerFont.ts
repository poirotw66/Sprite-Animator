import { useEffect } from 'react';
import type { LineStickerFontKey } from '../utils/lineStickerPresets';
import { resolveCanvasFontPresetKey } from '../utils/lineStickerPresets';
import { isBundledStickerFontPresetKey } from '../utils/lineStickerBundledFontCatalog';

/** Preload a bundled sticker font when the user picks a preset (fire-and-forget). */
export function useLazyBundledStickerFont(
  fontKey: LineStickerFontKey,
  enabled = true
): void {
  useEffect(() => {
    const canvasKey = resolveCanvasFontPresetKey(fontKey);
    if (!enabled || !isBundledStickerFontPresetKey(canvasKey)) {
      return;
    }
    void import('../utils/lineStickerBrowserFonts').then((mod) =>
      mod.ensureBundledStickerFontForPreset(canvasKey)
    );
  }, [enabled, fontKey]);
}
