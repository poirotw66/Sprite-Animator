import { describe, expect, it } from 'vitest';
import { buildCharacterRefPrompt, buildComicCharacterRefPrompt } from './characterRefPrompt';

describe('buildComicCharacterRefPrompt', () => {
  it('does not reference an attached layout image (avoids otter layout PNG)', () => {
    const prompt = buildComicCharacterRefPrompt({
      concept: 'A red dragon knight',
      styleKey: 'chibi',
      hasIdentityReference: false,
    });
    expect(prompt).toContain('no layout image attached');
    expect(prompt).not.toContain('attached layout image');
    expect(prompt).not.toMatch(/layout reference.*structure only/i);
    expect(prompt).toContain('Do **NOT** default to otter');
  });

  it('locks identity when user uploaded a reference image', () => {
    const prompt = buildComicCharacterRefPrompt({
      concept: '',
      styleKey: 'chibi',
      hasIdentityReference: true,
    });
    expect(prompt).toContain('Identity reference');
    expect(prompt).toContain('Do **NOT** substitute a different species');
  });
});

describe('buildCharacterRefPrompt (LINE skill)', () => {
  it('still documents layout image attachment for headless skill', () => {
    const prompt = buildCharacterRefPrompt({
      concept: 'test',
      styleKey: 'chibi',
    });
    expect(prompt).toContain('attached layout image');
  });
});
