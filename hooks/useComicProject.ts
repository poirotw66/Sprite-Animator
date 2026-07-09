import { useCallback, useEffect, useState } from 'react';
import {
  COMIC_PROJECT_STORAGE_KEY,
  createEmptyComicProject,
  type ComicPanel,
  type ComicProject,
} from '../utils/comicPanelSchema';

export type ComicWizardStep = 1 | 2 | 3 | 4;

function loadStoredProject(): ComicProject {
  try {
    const raw = localStorage.getItem(COMIC_PROJECT_STORAGE_KEY);
    if (!raw) return createEmptyComicProject();
    const parsed = JSON.parse(raw) as ComicProject;
    if (!parsed.panels || parsed.panels.length !== 4) return createEmptyComicProject();
    return parsed;
  } catch {
    return createEmptyComicProject();
  }
}

export function useComicProject() {
  const [project, setProject] = useState<ComicProject>(() => loadStoredProject());
  const [step, setStep] = useState<ComicWizardStep>(1);

  useEffect(() => {
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  const patchProject = useCallback((patch: Partial<ComicProject>) => {
    setProject((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }));
  }, []);

  const setPanels = useCallback(
    (panels: ComicPanel[]) => {
      patchProject({ panels });
    },
    [patchProject]
  );

  const resetProject = useCallback(() => {
    const fresh = createEmptyComicProject();
    setProject(fresh);
    setStep(1);
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  return { project, step, setStep, patchProject, setPanels, resetProject };
}
