import type { ComicProject } from './comicPanelSchema';
import { validatePanelsForGeneration } from './comicPanelSchema';

type ComicFlowErrorKey =
  | 'comicErrorNeedConcept'
  | 'comicErrorNeedUpload'
  | 'comicErrorNeedSheet'
  | 'comicErrorNeedPanels';

export interface ComicFlowState {
  canProceed: boolean;
  errorKey: ComicFlowErrorKey | null;
}

export interface ComicPageGenerationState {
  canGenerate: boolean;
  errorKey: ComicFlowErrorKey | null;
  missingIndices: number[];
}

export function getComicNextStepState(
  step: 1 | 2 | 3,
  project: ComicProject
): ComicFlowState {
  if (step === 1) {
    if (project.sourceMode === 'upload') {
      const hasUpload = Boolean(project.referenceImage);
      return {
        canProceed: hasUpload,
        errorKey: hasUpload ? null : 'comicErrorNeedUpload',
      };
    }
    const hasConcept = Boolean(project.characterConcept.trim());
    return {
      canProceed: hasConcept,
      errorKey: hasConcept ? null : 'comicErrorNeedConcept',
    };
  }

  if (step === 2) {
    const hasSheet = Boolean(project.characterSheetImage);
    return {
      canProceed: hasSheet,
      errorKey: hasSheet ? null : 'comicErrorNeedSheet',
    };
  }

  return {
    canProceed: true,
    errorKey: null,
  };
}

export function getComicPageGenerationState(
  project: ComicProject
): ComicPageGenerationState {
  if (!project.characterSheetImage) {
    return {
      canGenerate: false,
      errorKey: 'comicErrorNeedSheet',
      missingIndices: [],
    };
  }

  const validation = validatePanelsForGeneration(project.panels);
  if (!validation.ok) {
    return {
      canGenerate: false,
      errorKey: 'comicErrorNeedPanels',
      missingIndices: validation.missingIndices,
    };
  }

  return {
    canGenerate: true,
    errorKey: null,
    missingIndices: [],
  };
}
