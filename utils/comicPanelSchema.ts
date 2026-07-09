export const COMIC_LAYOUT_4A = { preset: '4A' as const, cols: 2, rows: 2 };
export const COMIC_PANEL_COUNT = COMIC_LAYOUT_4A.cols * COMIC_LAYOUT_4A.rows;
export const COMIC_DIALOGUE_MAX_LEN = 40;
export const COMIC_PROJECT_STORAGE_KEY = 'comic-project-v1';

export interface ComicPanel {
  index: number;
  sceneDescription: string;
  dialogue?: string;
  cameraNote?: string;
}

export interface ComicProject {
  id: string;
  createdAt: number;
  updatedAt: number;
  sourceMode: 'upload' | 'concept';
  referenceImage: string | null;
  characterConcept: string;
  styleKey: string;
  characterSheetImage: string | null;
  synopsis?: string;
  panels: ComicPanel[];
  pageImage: string | null;
  generationMeta?: {
    model: string;
    aspectRatio: '1:1';
    resolution: string;
  };
}

export function createEmptyPanels(): ComicPanel[] {
  return Array.from({ length: COMIC_PANEL_COUNT }, (_, index) => ({
    index,
    sceneDescription: '',
  }));
}

export function createEmptyComicProject(): ComicProject {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    sourceMode: 'concept',
    referenceImage: null,
    characterConcept: '',
    styleKey: 'chibi',
    characterSheetImage: null,
    panels: createEmptyPanels(),
    pageImage: null,
  };
}

export function clampComicDialogue(dialogue: string): string {
  const trimmed = dialogue.trim();
  if (trimmed.length <= COMIC_DIALOGUE_MAX_LEN) return trimmed;
  return trimmed.slice(0, COMIC_DIALOGUE_MAX_LEN);
}

export function validatePanelsForGeneration(panels: ComicPanel[]): {
  ok: boolean;
  missingIndices: number[];
} {
  const missingIndices = panels
    .filter((p) => !p.sceneDescription.trim())
    .map((p) => p.index);
  return { ok: missingIndices.length === 0 && panels.length === COMIC_PANEL_COUNT, missingIndices };
}
