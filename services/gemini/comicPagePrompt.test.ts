import { describe, expect, it } from 'vitest';
import { buildComicPagePrompt } from './comicPagePrompt';
import type { ComicPanel } from '../../utils/comicPanelSchema';

const panels: ComicPanel[] = [
  { index: 0, sceneDescription: 'Morning stretch', dialogue: '早安！' },
  { index: 1, sceneDescription: 'Spills coffee', dialogue: '糟糕…' },
  { index: 2, sceneDescription: 'Laughs it off' },
  { index: 3, sceneDescription: 'Runs to work', dialogue: '要遲到了！' },
];

describe('buildComicPagePrompt', () => {
  it('includes 2×2 layout, 1:1 aspect, and visible gutters', () => {
    const prompt = buildComicPagePrompt({
      panels,
      styleBlock: 'Chibi style, soft lines',
      characterConcept: 'Playful otter',
    });
    expect(prompt).toContain('2 columns × 2 rows');
    expect(prompt).toContain('1:1');
    expect(prompt).toMatch(/visible.*gutter|black.*border/i);
    expect(prompt).not.toContain('NO VISIBLE DIVIDERS');
  });

  it('includes all four panel scene blocks', () => {
    const prompt = buildComicPagePrompt({
      panels,
      styleBlock: 'Chibi',
      characterConcept: 'Otter',
    });
    expect(prompt).toContain('Panel 1');
    expect(prompt).toContain('Panel 4');
    expect(prompt).toContain('Morning stretch');
    expect(prompt).toContain('要遲到了');
  });

  it('locks character to attached sheet reference', () => {
    const prompt = buildComicPagePrompt({
      panels,
      styleBlock: 'Chibi',
      characterConcept: 'Otter',
    });
    expect(prompt).toMatch(/character sheet|reference sheet|do not redesign/i);
  });
});
