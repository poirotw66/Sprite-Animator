import { describe, expect, it } from 'vitest';
import {
  getBestAspectRatio,
  getLineStickerCanvasAspectPrompt,
} from './lineStickerSheetAspect';
import { buildLineStickerPrompt, DEFAULT_CHARACTER_SLOT, DEFAULT_TEXT_SLOT, THEME_PRESETS, STYLE_PRESETS } from './lineStickerPrompt';

describe('getBestAspectRatio', () => {
  it('returns 1:1 for square grids', () => {
    expect(getBestAspectRatio(4, 4)).toBe('1:1');
  });

  it('returns 3:4 for 4x5 grids', () => {
    expect(getBestAspectRatio(4, 5)).toBe('3:4');
  });
});

describe('getLineStickerCanvasAspectPrompt', () => {
  it('describes square canvas for 4x4', () => {
    expect(getLineStickerCanvasAspectPrompt(4, 4)).toBe('Square image (1:1 aspect ratio)');
  });

  it('describes portrait canvas for 4x5', () => {
    expect(getLineStickerCanvasAspectPrompt(4, 5)).toBe(
      'Portrait image (3:4 aspect ratio, width:height)'
    );
  });
});

describe('buildLineStickerPrompt layout aspect', () => {
  it('uses portrait aspect for 4x5 v3 prompts instead of square', () => {
    const prompt = buildLineStickerPrompt(
      {
        style: STYLE_PRESETS.matchUploaded,
        character: DEFAULT_CHARACTER_SLOT,
        theme: THEME_PRESETS.daily,
        text: DEFAULT_TEXT_SLOT,
      },
      4,
      5,
      'green',
      true,
      undefined,
      'v3'
    );

    expect(prompt).toContain('Portrait image (3:4 aspect ratio, width:height)');
    expect(prompt).not.toContain('Square image (1:1');
  });
});
