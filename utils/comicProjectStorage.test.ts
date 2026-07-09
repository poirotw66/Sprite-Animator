import { describe, expect, it, beforeEach, vi } from 'vitest';
import { COMIC_PROJECT_STORAGE_KEY, createEmptyComicProject } from './comicPanelSchema';
import {
  loadComicProjectMeta,
  purgeBloatedComicProjectLocalStorage,
  saveComicProjectMeta,
  stripComicProjectImages,
} from './comicProjectStorage';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('comicProjectStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.stubGlobal('sessionStorage', createStorageMock());
  });

  it('never reloads images from localStorage', () => {
    const project = createEmptyComicProject();
    project.characterConcept = 'Dragon knight';
    project.referenceImage = 'data:image/png;base64,huge';

    localStorage.setItem(
      COMIC_PROJECT_STORAGE_KEY,
      JSON.stringify({
        ...stripComicProjectImages(project),
        referenceImage: project.referenceImage,
      })
    );

    const meta = loadComicProjectMeta();
    expect(meta.characterConcept).toBe('Dragon knight');
    expect('referenceImage' in meta).toBe(false);
  });

  it('purges bloated localStorage entries', () => {
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, 'x'.repeat(60_000));
    expect(purgeBloatedComicProjectLocalStorage()).toBe(true);
    expect(localStorage.getItem(COMIC_PROJECT_STORAGE_KEY)).toBeNull();
  });

  it('saveComicProjectMeta stores metadata without images', () => {
    const project = createEmptyComicProject();
    project.characterConcept = 'Fox barista';
    saveComicProjectMeta(stripComicProjectImages(project));

    const raw = localStorage.getItem(COMIC_PROJECT_STORAGE_KEY) ?? '';
    expect(raw).toContain('Fox barista');
    expect(raw).not.toContain('data:image');
  });
});
