import { describe, expect, it } from 'vitest';
import { createEmptyComicProject } from './comicPanelSchema';
import {
  canGenerateComicCharacterSheet,
  resolveComicSheetReferenceImage,
} from './comicSheetInput';

describe('comicSheetInput', () => {
  it('uses reference image only in upload mode', () => {
    const project = createEmptyComicProject();
    project.sourceMode = 'concept';
    project.referenceImage = 'data:image/png;base64,abc';
    expect(resolveComicSheetReferenceImage(project)).toBeNull();

    project.sourceMode = 'upload';
    expect(resolveComicSheetReferenceImage(project)).toBe('data:image/png;base64,abc');
  });

  it('requires upload in upload mode even if concept text exists', () => {
    const project = createEmptyComicProject();
    project.sourceMode = 'upload';
    project.characterConcept = 'A dragon knight';
    expect(canGenerateComicCharacterSheet(project)).toBe(false);

    project.referenceImage = 'data:image/jpeg;base64,xyz';
    expect(canGenerateComicCharacterSheet(project)).toBe(true);
  });
});
