import { describe, expect, it } from 'vitest';
import { FONT_PRESET_ORDER, resolveFontStylePromptDesc } from './lineStickerPrompt';
import { resolveFontKeyForStyle, resolveCanvasFontPresetKey } from './lineStickerPresets';

describe('resolveFontKeyForStyle', () => {
  it('maps art styles to paired caption fonts', () => {
    expect(resolveFontKeyForStyle('matchUploaded')).toBe('matchUploaded');
    expect(resolveFontKeyForStyle('pixel')).toBe('fashionBitmap16');
    expect(resolveFontKeyForStyle('kidDoodle')).toBe('kidDoodle');
    expect(resolveFontKeyForStyle('watercolor')).toBe('sweetChalk');
  });

  it('keeps explicit fontKey when provided', () => {
    expect(resolveFontKeyForStyle('pixel', 'round')).toBe('round');
  });

  it('maps reference-adaptive font to canvas fallback', () => {
    expect(resolveCanvasFontPresetKey('matchUploaded')).toBe('kanaka');
  });
});

describe('resolveFontStylePromptDesc', () => {
  it('uses preset prompt for built-in fonts', () => {
    expect(resolveFontStylePromptDesc('round', '')).toMatch(/Round soft sticker font/);
  });

  it('wraps custom user description for model prompts', () => {
    expect(resolveFontStylePromptDesc('custom', 'Neon glow pixel font')).toMatch(
      /Neon glow pixel font/
    );
  });

  it('adds art-style harmony note for model prompts', () => {
    expect(resolveFontStylePromptDesc('round', '', 'pixel')).toMatch(/harmonize with the 像素藝術/);
    expect(resolveFontStylePromptDesc('matchUploaded', '', 'matchUploaded')).toMatch(
      /uploaded reference illustration/
    );
    expect(resolveFontStylePromptDesc('matchUploaded', '', 'matchUploaded')).toMatch(
      /same artist who drew the reference/
    );
  });
});

describe('FONT_PRESET_ORDER', () => {
  it('keeps built-in presets plus custom last', () => {
    expect(FONT_PRESET_ORDER).toHaveLength(20);
    expect(FONT_PRESET_ORDER[0]).toBe('matchUploaded');
    expect(FONT_PRESET_ORDER).toContain('mochiRound');
    expect(FONT_PRESET_ORDER).toContain('bubblePop');
    expect(FONT_PRESET_ORDER).toContain('kidDoodle');
    expect(FONT_PRESET_ORDER).toContain('liyushoushu');
    expect(FONT_PRESET_ORDER).toContain('fashionBitmap16');
    expect(FONT_PRESET_ORDER).toContain('kanaka');
    expect(FONT_PRESET_ORDER).toContain('naikai');
    expect(FONT_PRESET_ORDER.at(-1)).toBe('custom');
  });
});
