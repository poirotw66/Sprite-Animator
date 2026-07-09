import { useCallback, useEffect, useState } from 'react';
import {
  COMIC_PROJECT_STORAGE_KEY,
  createEmptyComicProject,
  type ComicPanel,
  type ComicProject,
} from '../utils/comicPanelSchema';

export type ComicWizardStep = 1 | 2 | 3 | 4;

const COMIC_REFERENCE_SESSION_KEY = 'comic-reference-image-v1';
const COMIC_SHEET_SESSION_KEY = 'comic-character-sheet-v1';
const COMIC_PAGE_SESSION_KEY = 'comic-page-image-v1';

function readSessionImage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionImage(key: string, value: string | null): void {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ponytail: sessionStorage quota — in-memory state still holds the image this session
  }
}

function stripBinaryFields(project: ComicProject): Omit<
  ComicProject,
  'referenceImage' | 'characterSheetImage' | 'pageImage'
> {
  const { referenceImage: _r, characterSheetImage: _s, pageImage: _p, ...meta } = project;
  return meta;
}

function loadStoredProject(): ComicProject {
  try {
    const raw = localStorage.getItem(COMIC_PROJECT_STORAGE_KEY);
    if (!raw) return createEmptyComicProject();
    const parsed = JSON.parse(raw) as ComicProject;
    if (!parsed.panels || parsed.panels.length !== 4) return createEmptyComicProject();
    return {
      ...parsed,
      referenceImage: readSessionImage(COMIC_REFERENCE_SESSION_KEY),
      characterSheetImage: readSessionImage(COMIC_SHEET_SESSION_KEY),
      pageImage: readSessionImage(COMIC_PAGE_SESSION_KEY),
    };
  } catch {
    return createEmptyComicProject();
  }
}

export function useComicProject() {
  const [project, setProject] = useState<ComicProject>(() => loadStoredProject());
  const [step, setStep] = useState<ComicWizardStep>(1);

  useEffect(() => {
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, JSON.stringify(stripBinaryFields(project)));
    writeSessionImage(COMIC_REFERENCE_SESSION_KEY, project.referenceImage);
    writeSessionImage(COMIC_SHEET_SESSION_KEY, project.characterSheetImage);
    writeSessionImage(COMIC_PAGE_SESSION_KEY, project.pageImage);
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
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, JSON.stringify(stripBinaryFields(fresh)));
    writeSessionImage(COMIC_REFERENCE_SESSION_KEY, null);
    writeSessionImage(COMIC_SHEET_SESSION_KEY, null);
    writeSessionImage(COMIC_PAGE_SESSION_KEY, null);
  }, []);

  return { project, step, setStep, patchProject, setPanels, resetProject };
}
