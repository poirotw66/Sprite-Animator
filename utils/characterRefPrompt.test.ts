import { describe, expect, it } from 'vitest';
import {
  CHARACTER_REF_SHEET_LAYOUT_TEXT,
  buildCharacterRefPrompt,
  buildComicCharacterRefPrompt,
} from './characterRefPrompt';

describe('CHARACTER_REF_SHEET_LAYOUT_TEXT', () => {
  it('describes turnaround, expressions, and detail row without image attachment', () => {
    expect(CHARACTER_REF_SHEET_LAYOUT_TEXT).toContain('text only');
    expect(CHARACTER_REF_SHEET_LAYOUT_TEXT).toContain('Full-body turnaround');
    expect(CHARACTER_REF_SHEET_LAYOUT_TEXT).toContain('Expression headshots');
    expect(CHARACTER_REF_SHEET_LAYOUT_TEXT).not.toContain('paw pads');
  });
});

describe('buildCharacterRefPrompt', () => {
  it('uses text-only layout and avoids otter bias when no identity image', () => {
    const prompt = buildCharacterRefPrompt({
      concept: 'A red dragon knight',
      styleKey: 'chibi',
    });
    expect(prompt).toContain('Sheet layout — text only');
    expect(prompt).not.toContain('attached layout image');
    expect(prompt).toContain('Do **NOT** default to otter');
    expect(prompt).toContain('LINE sticker production');
  });

  it('locks identity when user uploaded a reference image', () => {
    const prompt = buildCharacterRefPrompt({
      concept: 'long hair girl in white shirt',
      styleKey: 'chibi',
      hasIdentityReference: true,
    });
    expect(prompt).toContain('Identity reference');
    expect(prompt).toContain('Do **NOT** substitute a different species');
    expect(prompt).not.toContain('attached layout image');
  });
});

describe('buildComicCharacterRefPrompt', () => {
  it('delegates to text-only layout for comic flow', () => {
    const prompt = buildComicCharacterRefPrompt({
      concept: 'A red dragon knight',
      styleKey: 'chibi',
      hasIdentityReference: false,
    });
    expect(prompt).toContain('Sheet layout — text only');
    expect(prompt).toContain('one-page comic');
    expect(prompt).not.toContain('attached layout image');
  });
});
