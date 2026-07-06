import { describe, expect, it } from 'vitest';
import {
  getBestAspectRatio,
  getLineStickerCanvasAspectPrompt,
  getLineStickerCellPixelSize,
  getLineStickerSpriteSheetAspectRatio,
  LINE_STICKER_SPRITE_SHEET_SIZE_PX,
} from './lineStickerSheetAspect';
import { buildLineStickerPrompt, DEFAULT_CHARACTER_SLOT, DEFAULT_TEXT_SLOT, THEME_PRESETS, STYLE_PRESETS } from './lineStickerPrompt';

describe('getBestAspectRatio', () => {
  it('returns 1:1 for square grids', () => {
    expect(getBestAspectRatio(4, 4)).toBe('1:1');
  });

  it('returns 3:4 for 4x5 grids (animation / non-LINE)', () => {
    expect(getBestAspectRatio(4, 5)).toBe('3:4');
  });
});

describe('LINE sticker sprite sheet aspect', () => {
  it('always uses 1:1 for LINE sticker generation', () => {
    expect(getLineStickerSpriteSheetAspectRatio()).toBe('1:1');
    expect(getLineStickerCanvasAspectPrompt(4, 5)).toBe('Square image (1:1 aspect ratio)');
  });

  it('computes 4x5 cell size on 1024px canvas', () => {
    expect(getLineStickerCellPixelSize(4, 5)).toEqual({
      cellWidth: 256,
      cellHeight: 204,
    });
    expect(LINE_STICKER_SPRITE_SHEET_SIZE_PX).toBe(1024);
  });
});

describe('buildLineStickerPrompt layout aspect', () => {
  const slots = {
    style: STYLE_PRESETS.matchUploaded,
    character: DEFAULT_CHARACTER_SLOT,
    theme: THEME_PRESETS.daily,
    text: DEFAULT_TEXT_SLOT,
  };
  const actions = Array.from({ length: 20 }, (_, i) => `waving hello (${i + 1})`);

  it('uses square 1024 canvas wording for 4x5 v3 prompts', () => {
    const prompt = buildLineStickerPrompt(slots, 4, 5, 'green', true, undefined, 'v3');

    expect(prompt).toContain('Square image (1:1 aspect ratio)');
    expect(prompt).not.toContain('Portrait image (3:4');
  });

  it('v3compact is shorter than v3 for the same 4x5 sheet', () => {
    const v3 = buildLineStickerPrompt(slots, 4, 5, 'green', true, actions, 'v3');
    const compact = buildLineStickerPrompt(slots, 4, 5, 'green', true, actions, 'v3compact');
    expect(compact.length).toBeLessThan(v3.length * 0.75);
    expect(compact).toContain('1|"');
    expect(compact).not.toContain('Cell 1 (row 1, col 1)');
  });
});
