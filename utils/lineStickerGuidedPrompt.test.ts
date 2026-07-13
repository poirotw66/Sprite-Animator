import { describe, expect, it } from 'vitest';
import {
  buildGuidedCompactLayoutBlock,
  buildGuidedSuffixLayoutBlock,
  formatGuidedCompactCellLine,
} from './lineStickerGuidedPrompt';
import {
  buildLineStickerPrompt,
  DEFAULT_CHARACTER_SLOT,
  DEFAULT_TEXT_SLOT,
  STYLE_PRESETS,
  THEME_PRESETS,
} from './lineStickerPrompt';
import { buildLineStickerPromptSuffix } from '../services/gemini/spriteSheetPrompts';

describe('lineStickerGuidedPrompt', () => {
  it('labels each compact cell with row and col', () => {
    expect(formatGuidedCompactCellLine(0, 4, '早安', 'wave', true)).toContain('row 1, col 1');
    expect(formatGuidedCompactCellLine(3, 4, '收到啦', 'salute', true)).toContain('row 1, col 4');
    expect(formatGuidedCompactCellLine(4, 4, '謝謝喔', 'bow', true)).toContain('row 2, col 1');
  });

  it('guided suffix requires in-cell placement and omits NO VISIBLE DIVIDERS', () => {
    const block = buildGuidedSuffixLayoutBlock(4, 5, 20, true);
    expect(block).toContain('GUIDED GRID EDIT');
    expect(block).toContain('fully inside');
    expect(block).not.toContain('NO VISIBLE DIVIDERS');
  });

  it('guided compact layout omits NO visible dividers', () => {
    const block = buildGuidedCompactLayoutBlock(4, 5, 20, 25, 20, '#00FF00');
    expect(block).toContain('GUIDED GRID');
    expect(block).toContain('in place');
    expect(block).not.toContain('NO visible dividers');
  });
});

describe('buildLineStickerPrompt guided branch', () => {
  const slots = {
    style: STYLE_PRESETS.lineChibi,
    character: DEFAULT_CHARACTER_SLOT,
    theme: THEME_PRESETS.daily,
    text: DEFAULT_TEXT_SLOT,
  };

  it('v3compact guided uses row/col cell lines', () => {
    const prompt = buildLineStickerPrompt(slots, 4, 5, 'green', true, ['wave'], 'v3compact', false, true);
    expect(prompt).toContain('guided grid');
    expect(prompt).toContain('Cell 1 (row 1, col 1)');
    expect(prompt).not.toContain('NO visible dividers');
    expect(prompt).toContain('fully contained in its cell');
  });

  it('buildLineStickerPromptSuffix guided omits NO VISIBLE DIVIDERS', () => {
    const body = buildLineStickerPrompt(slots, 4, 5, 'green', true, ['wave'], 'v3compact', false, true);
    const full = buildLineStickerPromptSuffix(body, {
      cols: 4,
      rows: 5,
      totalFrames: 20,
      bgColorHex: '#00FF00',
      bgColorRGB: 'RGB(0, 255, 0)',
      chromaKeyColor: 'green',
      includeText: true,
      guidedMode: true,
    });
    expect(full).toContain('Cell placement (CRITICAL)');
    expect(full).not.toContain('NO VISIBLE DIVIDERS');
  });
});
