import {
  COMIC_PROJECT_STORAGE_KEY,
  createEmptyComicProject,
  createEmptyPanels,
  type ComicProject,
} from './comicPanelSchema';

/** Legacy keys that stored full base64 images and could fill browser quota. */
const LEGACY_IMAGE_SESSION_KEYS = [
  'comic-reference-image-v1',
  'comic-character-sheet-v1',
  'comic-page-image-v1',
] as const;

export type ComicProjectMeta = Omit<
  ComicProject,
  'referenceImage' | 'characterSheetImage' | 'pageImage'
>;

export function stripComicProjectImages(project: ComicProject): ComicProjectMeta {
  const { referenceImage: _r, characterSheetImage: _s, pageImage: _p, ...meta } = project;
  return meta;
}

export function purgeLegacyComicImageStorage(): void {
  for (const key of LEGACY_IMAGE_SESSION_KEYS) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }
  return (
    error.name === 'QuotaExceededError' ||
    error.code === 22 ||
    error.code === 1014
  );
}

/** Remove bloated comic-project entries that embedded base64 images (pre-fix deploys). */
export function purgeBloatedComicProjectLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(COMIC_PROJECT_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    if (raw.length < 50_000) {
      return false;
    }
    localStorage.removeItem(COMIC_PROJECT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadComicProjectMeta(): ComicProjectMeta {
  purgeLegacyComicImageStorage();
  purgeBloatedComicProjectLocalStorage();

  try {
    const raw = localStorage.getItem(COMIC_PROJECT_STORAGE_KEY);
    if (!raw) {
      return stripComicProjectImages(createEmptyComicProject());
    }

    const parsed = JSON.parse(raw) as Partial<ComicProjectMeta> & {
      referenceImage?: string | null;
      characterSheetImage?: string | null;
      pageImage?: string | null;
    };

    const base = createEmptyComicProject();
    const panels =
      parsed.panels && parsed.panels.length === 4 ? parsed.panels : createEmptyPanels();

    const {
      referenceImage: _r,
      characterSheetImage: _s,
      pageImage: _p,
      ...parsedMeta
    } = parsed;

    return {
      ...stripComicProjectImages(base),
      ...parsedMeta,
      panels,
    };
  } catch {
    return stripComicProjectImages(createEmptyComicProject());
  }
}

export function saveComicProjectMeta(meta: ComicProjectMeta): void {
  const payload = JSON.stringify(meta);
  try {
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, payload);
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      return;
    }
  }

  try {
    localStorage.removeItem(COMIC_PROJECT_STORAGE_KEY);
    purgeLegacyComicImageStorage();
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, payload);
  } catch {
    // Images live in memory only; failing to persist text state is non-fatal.
  }
}

export function mergeComicProject(
  meta: ComicProjectMeta,
  images: {
    referenceImage: string | null;
    characterSheetImage: string | null;
    pageImage: string | null;
  }
): ComicProject {
  return {
    ...meta,
    referenceImage: images.referenceImage,
    characterSheetImage: images.characterSheetImage,
    pageImage: images.pageImage,
  };
}
