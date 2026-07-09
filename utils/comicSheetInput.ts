import type { ComicProject } from './comicPanelSchema';

export function resolveComicSheetReferenceImage(project: ComicProject): string | null {
  if (project.sourceMode !== 'upload') {
    return null;
  }
  return project.referenceImage;
}

export function canGenerateComicCharacterSheet(project: ComicProject): boolean {
  if (project.sourceMode === 'upload') {
    return Boolean(project.referenceImage);
  }
  return Boolean(project.characterConcept.trim());
}
