import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('lineStickerBrowserFonts', () => {
  it('does not make an optional browser font failure break the CJK fallback stack', async () => {
    const faceLoad = vi.fn().mockRejectedValue(new Error('woff2 unavailable'));
    const fontFaceConstructed = vi.fn();
    const add = vi.fn();

    class FailingFontFace {
      constructor(...args: unknown[]) {
        fontFaceConstructed(...args);
      }

      load() {
        return faceLoad();
      }
    }

    vi.stubGlobal('document', { fonts: { add } });
    vi.stubGlobal('FontFace', FailingFontFace);

    const { ensureBundledStickerFontForPreset } = await import('./lineStickerBrowserFonts');

    await expect(ensureBundledStickerFontForPreset('liyushoushu')).resolves.toBeUndefined();
    await expect(ensureBundledStickerFontForPreset('liyushoushu')).resolves.toBeUndefined();

    // A clean checkout intentionally has no local WOFF2 vault, while a local
    // build exercises the rejected FontFace path. Both must settle without a
    // second request for the same optional display font.
    expect(fontFaceConstructed.mock.calls.length).toBeLessThanOrEqual(1);
    expect(faceLoad).toHaveBeenCalledTimes(fontFaceConstructed.mock.calls.length);
    expect(add).not.toHaveBeenCalled();
  });

  it('is a no-op outside the browser', async () => {
    const { ensureBundledStickerFontForPreset } = await import('./lineStickerBrowserFonts');

    await expect(ensureBundledStickerFontForPreset('kanaka')).resolves.toBeUndefined();
  });
});
