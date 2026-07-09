import { describe, expect, it } from 'vitest';
import { parseComicStoryboardJson } from './comicStoryboard';

describe('parseComicStoryboardJson', () => {
  it('parses valid JSON array of 4 panels', () => {
    const raw = JSON.stringify([
      { sceneDescription: 'A', dialogue: '嗨' },
      { sceneDescription: 'B' },
      { sceneDescription: 'C', dialogue: '嗯' },
      { sceneDescription: 'D' },
    ]);
    const panels = parseComicStoryboardJson(raw);
    expect(panels).toHaveLength(4);
    expect(panels[0]).toMatchObject({ index: 0, sceneDescription: 'A', dialogue: '嗨' });
  });

  it('strips markdown fences before parse', () => {
    const raw = '```json\n[{"sceneDescription":"X"},{"sceneDescription":"Y"},{"sceneDescription":"Z"},{"sceneDescription":"W"}]\n```';
    expect(parseComicStoryboardJson(raw)).toHaveLength(4);
  });

  it('throws when count is not 4', () => {
    expect(() => parseComicStoryboardJson('[{"sceneDescription":"only one"}]')).toThrow(/4/);
  });
});
