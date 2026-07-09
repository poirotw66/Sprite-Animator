import { describe, expect, it } from 'vitest';
import { createEmptyComicProject, createEmptyPanels } from './comicPanelSchema';
import {
  getComicNextStepState,
  getComicPageGenerationState,
} from './comicPageFlow';

describe('comicPageFlow', () => {
  it('blocks step 1 until concept or reference image exists', () => {
    const project = createEmptyComicProject();

    expect(getComicNextStepState(1, project)).toEqual({
      canProceed: false,
      errorKey: 'comicErrorNeedConcept',
    });

    project.characterConcept = 'Sleepy otter barista';
    expect(getComicNextStepState(1, project)).toEqual({
      canProceed: true,
      errorKey: null,
    });
  });

  it('blocks step 2 until a character sheet exists', () => {
    const project = createEmptyComicProject();
    project.characterConcept = 'Sleepy otter barista';

    expect(getComicNextStepState(2, project)).toEqual({
      canProceed: false,
      errorKey: 'comicErrorNeedSheet',
    });

    project.characterSheetImage = 'data:image/png;base64,sheet';
    expect(getComicNextStepState(2, project)).toEqual({
      canProceed: true,
      errorKey: null,
    });
  });

  it('always allows step 3 to continue to the result screen', () => {
    const project = createEmptyComicProject();
    expect(getComicNextStepState(3, project)).toEqual({
      canProceed: true,
      errorKey: null,
    });
  });

  it('blocks page generation until every panel has a scene description', () => {
    const project = createEmptyComicProject();
    project.characterSheetImage = 'data:image/png;base64,sheet';
    project.panels = createEmptyPanels();
    project.panels[0]!.sceneDescription = 'Otter wakes up late';

    expect(getComicPageGenerationState(project)).toEqual({
      canGenerate: false,
      errorKey: 'comicErrorNeedPanels',
      missingIndices: [1, 2, 3],
    });
  });

  it('allows page generation when sheet and all 4 panels are ready', () => {
    const project = createEmptyComicProject();
    project.characterSheetImage = 'data:image/png;base64,sheet';
    project.panels = createEmptyPanels().map((panel, index) => ({
      ...panel,
      sceneDescription: `Scene ${index + 1}`,
    }));

    expect(getComicPageGenerationState(project)).toEqual({
      canGenerate: true,
      errorKey: null,
      missingIndices: [],
    });
  });
});
