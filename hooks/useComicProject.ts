import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createEmptyComicProject,
  type ComicPanel,
  type ComicProject,
} from '../utils/comicPanelSchema';
import {
  loadComicProjectMeta,
  mergeComicProject,
  purgeLegacyComicImageStorage,
  saveComicProjectMeta,
  stripComicProjectImages,
  type ComicProjectMeta,
} from '../utils/comicProjectStorage';

export type ComicWizardStep = 1 | 2 | 3 | 4;

export function useComicProject() {
  const [meta, setMeta] = useState<ComicProjectMeta>(() => loadComicProjectMeta());
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [characterSheetImage, setCharacterSheetImage] = useState<string | null>(null);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [step, setStep] = useState<ComicWizardStep>(1);

  const project = useMemo(
    (): ComicProject =>
      mergeComicProject(meta, {
        referenceImage,
        characterSheetImage,
        pageImage,
      }),
    [meta, referenceImage, characterSheetImage, pageImage]
  );

  useEffect(() => {
    saveComicProjectMeta(meta);
  }, [meta]);

  const patchProject = useCallback((patch: Partial<ComicProject>) => {
    const {
      referenceImage: nextReference,
      characterSheetImage: nextSheet,
      pageImage: nextPage,
      ...metaPatch
    } = patch;

    if (Object.keys(metaPatch).length > 0) {
      setMeta((prev) => ({ ...prev, ...metaPatch, updatedAt: Date.now() }));
    }

    if (nextReference !== undefined) {
      setReferenceImage(nextReference);
    }
    if (nextSheet !== undefined) {
      setCharacterSheetImage(nextSheet);
    }
    if (nextPage !== undefined) {
      setPageImage(nextPage);
    }
  }, []);

  const setPanels = useCallback((panels: ComicPanel[]) => {
    setMeta((prev) => ({ ...prev, panels, updatedAt: Date.now() }));
  }, []);

  const resetProject = useCallback(() => {
    const fresh = createEmptyComicProject();
    setMeta(stripComicProjectImages(fresh));
    setReferenceImage(null);
    setCharacterSheetImage(null);
    setPageImage(null);
    setStep(1);
    purgeLegacyComicImageStorage();
    saveComicProjectMeta(stripComicProjectImages(fresh));
  }, []);

  return { project, step, setStep, patchProject, setPanels, resetProject };
}
