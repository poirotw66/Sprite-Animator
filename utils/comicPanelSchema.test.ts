import { describe, expect, it } from 'vitest';
import {
  COMIC_LAYOUT_4A,
  COMIC_PANEL_COUNT,
  COMIC_DIALOGUE_MAX_LEN,
  createEmptyComicProject,
  createEmptyPanels,
  validatePanelsForGeneration,
  clampComicDialogue,
} from './comicPanelSchema';

describe('comicPanelSchema', () => {
  it('locks 4A layout to 2×2 with 4 panels', () => {
    expect(COMIC_LAYOUT_4A).toEqual({ preset: '4A', cols: 2, rows: 2 });
    expect(COMIC_PANEL_COUNT).toBe(4);
  });

  it('createEmptyPanels returns 4 indexed panels', () => {
    const panels = createEmptyPanels();
    expect(panels).toHaveLength(4);
    expect(panels.map((p) => p.index)).toEqual([0, 1, 2, 3]);
  });

  it('validatePanelsForGeneration requires scene text on all 4 panels', () => {
    const panels = createEmptyPanels();
    panels[0]!.sceneDescription = 'Otter waves hello';
    const result = validatePanelsForGeneration(panels);
    expect(result.ok).toBe(false);
    expect(result.missingIndices).toEqual([1, 2, 3]);
  });

  it('clampComicDialogue truncates long zh-TW dialogue', () => {
    const long = '這'.repeat(COMIC_DIALOGUE_MAX_LEN + 10);
    expect(clampComicDialogue(long).length).toBe(COMIC_DIALOGUE_MAX_LEN);
  });

  it('createEmptyComicProject defaults to 4A panels', () => {
    const project = createEmptyComicProject();
    expect(project.panels).toHaveLength(4);
    expect(project.sourceMode).toBe('concept');
  });
});
