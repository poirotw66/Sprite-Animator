import { describe, expect, it } from 'vitest';
import { FONT_PRESET_ORDER, resolveFontStylePromptDesc } from './lineStickerPrompt';

describe('resolveFontStylePromptDesc', () => {
  it('uses preset prompt for built-in fonts', () => {
    expect(resolveFontStylePromptDesc('round', '')).toMatch(/Round soft sticker font/);
  });

  it('wraps custom user description for model prompts', () => {
    expect(resolveFontStylePromptDesc('custom', 'Neon glow pixel font')).toMatch(
      /Neon glow pixel font/
    );
  });
});

describe('FONT_PRESET_ORDER', () => {
  it('keeps seven presets plus custom', () => {
    expect(FONT_PRESET_ORDER).toHaveLength(8);
    expect(FONT_PRESET_ORDER.at(-1)).toBe('custom');
  });
});
