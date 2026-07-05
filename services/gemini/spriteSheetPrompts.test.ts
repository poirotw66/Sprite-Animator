import { describe, expect, it } from 'vitest';
import {
  buildGridLayoutAnchorBlock,
  buildGridLayoutReminderBlock,
} from './spriteSheetPrompts';

describe('spriteSheetPrompts grid anchors', () => {
  it('buildGridLayoutAnchorBlock states exact 4×5 geometry and forbids 5×5', () => {
    const block = buildGridLayoutAnchorBlock(4, 5);
    expect(block).toContain('4 columns × 5 rows');
    expect(block).toContain('20 cells');
    expect(block).toContain('NOT 5');
    expect(block).toContain('5×5');
    expect(block).toContain('Row 1: cells 1–4');
    expect(block).toContain('Row 5: cells 17–20');
  });

  it('buildGridLayoutReminderBlock repeats column count', () => {
    const block = buildGridLayoutReminderBlock(4, 5);
    expect(block).toContain('4 columns × 5 rows');
    expect(block).toContain('20 cells');
  });
});
