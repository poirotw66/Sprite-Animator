import { GoogleGenAI } from '@google/genai';
import { PHRASE_GENERATION_MODEL } from '../../utils/constants';
import {
  COMIC_PANEL_COUNT,
  clampComicDialogue,
  type ComicPanel,
} from '../../utils/comicPanelSchema';
import { API_KEY_MISSING_MESSAGE } from './types';
import { retryOperation } from './retry';

interface StoryboardEntry {
  sceneDescription?: string;
  dialogue?: string;
  cameraNote?: string;
}

export function parseComicStoryboardJson(raw: string): ComicPanel[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(stripped) as StoryboardEntry[];
  if (!Array.isArray(parsed) || parsed.length !== COMIC_PANEL_COUNT) {
    throw new Error(`Comic storyboard must contain exactly ${COMIC_PANEL_COUNT} panels`);
  }
  return parsed.map((entry, index) => ({
    index,
    sceneDescription: (entry.sceneDescription ?? '').trim(),
    dialogue: entry.dialogue ? clampComicDialogue(entry.dialogue) : undefined,
    cameraNote: entry.cameraNote?.trim() || undefined,
  }));
}

export async function generateComicStoryboard(
  apiKey: string,
  characterConcept: string,
  synopsis: string,
  model: string = PHRASE_GENERATION_MODEL,
  signal?: AbortSignal
): Promise<ComicPanel[]> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a comic storyboard writer for a 4-panel yonkoma (2×2 grid).

### Character
${characterConcept.trim()}

### Synopsis
${synopsis.trim()}

### Task
Write exactly ${COMIC_PANEL_COUNT} panels for one page. Reading order: panel 1 top-left → 2 top-right → 3 bottom-left → 4 bottom-right.

### Output format — STRICT JSON only
Return a JSON array of exactly ${COMIC_PANEL_COUNT} objects:
[
  { "sceneDescription": "English visual direction for image model", "dialogue": "繁體中文台詞或省略", "cameraNote": "optional" }
]

Rules:
- sceneDescription: concrete, drawable action (English).
- dialogue: Traditional Chinese only when characters speak; omit key if silent panel.
- No markdown, no commentary, no extra keys.
- Complete mini-story arc across 4 panels.`;

  const response = await retryOperation(
    () =>
      ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: { temperature: 0.8, abortSignal: signal },
      }),
    undefined,
    5,
    4000,
    signal
  );

  const text = response.text ?? '';
  return parseComicStoryboardJson(text);
}
