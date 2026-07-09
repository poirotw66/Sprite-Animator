# One-Page Comic (4A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser wizard at `/one-page-comic` that produces a downloadable 2×2 four-panel comic page from a character reference, design sheet, and storyboard — using a single Gemini image call per page (Approach A).

**Architecture:** Four-step wizard (`Upload → Character sheet → Storyboard → Generate`) backed by `ComicProject` state in `localStorage`. Gemini services are split by concern (`comicCharacterSheet`, `comicStoryboard`, `comicPage`) and reuse shared `STYLE_PRESETS`, `retryOperation`, `useSettings`, and extracted character-ref prompt/image helpers. Page prompts use **visible black gutters** (not LINE invisible-grid rules). MVP is **4A only** (fixed 2×2, 1:1).

**Tech Stack:** React 19, TypeScript, Vite, Vitest, `@google/genai`, Tailwind CSS, existing `useSettings` / `SettingsModal` / `ImageUpload` patterns.

**Spec:** `docs/superpowers/specs/2026-07-09-one-page-comic-design.md`

---

## File Map (Phase 1 MVP)

| File | Responsibility |
|------|----------------|
| `utils/comicPanelSchema.ts` | `ComicPanel`, `ComicProject`, 4A constants, validation, factory |
| `utils/comicPanelSchema.test.ts` | Schema unit tests |
| `utils/characterRefPrompt.ts` | **Extracted** from skill — `buildCharacterRefPrompt`, `resolveStyleBlock` |
| `utils/loadBundledImage.ts` | Fetch bundled PNG → base64 data URL (layout ref) |
| `services/gemini/characterRefImage.ts` | **Extracted** from skill — `generateCharacterRefImage` |
| `services/gemini/comicCharacterSheet.ts` | Web wrapper: prompt + layout ref + optional identity ref |
| `services/gemini/comicPagePrompt.ts` | 2×2 page prompt with visible gutters + panel blocks |
| `services/gemini/comicPagePrompt.test.ts` | Prompt content tests |
| `services/gemini/comicStoryboard.ts` | Text model → exactly 4 panels JSON |
| `services/gemini/comicStoryboard.test.ts` | Parse / enforce length 4 |
| `services/gemini/comicPage.ts` | Single page image call (no chroma key) |
| `services/geminiService.ts` | Re-export new comic functions |
| `hooks/useComicProject.ts` | Project state + `localStorage` persistence |
| `hooks/useComicCharacterSheet.ts` | Sheet generation hook |
| `hooks/useComicStoryboard.ts` | Panel CRUD + AI fill |
| `hooks/useComicPageGeneration.ts` | Page generation + download helper |
| `components/Comic/ComicWizardSteps.tsx` | Step indicator (1–4) |
| `components/Comic/ComicSourceStep.tsx` | Upload vs concept (Step 1) |
| `components/Comic/ComicCharacterSheetStep.tsx` | Style + generate sheet (Step 2) |
| `components/Comic/ComicStoryboardStep.tsx` | 2×2 panel cards + AI fill (Step 3) |
| `components/Comic/ComicResultStep.tsx` | Preview + download PNG (Step 4) |
| `components/Comic/index.ts` | Barrel export |
| `pages/OnePageComicPage.tsx` | Route page orchestration |
| `reference/comic/model-sheet-layout.png` | Copy from skill reference (Vite-bundled) |
| `App.tsx` | Lazy route `/one-page-comic` |
| `pages/HomePage.tsx` | Tool card `one-page-comic` |
| `i18n/types.ts`, `i18n/zh-TW.ts`, `i18n/en.ts` | `comic*` translation keys |

**Modify (skill re-exports only):**

- `.claude/skills/line-sticker-character-ref/scripts/characterRefPrompt.ts` → re-export from `utils/characterRefPrompt.ts`
- `.claude/skills/line-sticker-character-ref/scripts/geminiCharacterRef.mts` → re-export from `services/gemini/characterRefImage.ts`

---

### Task 1: Comic panel schema and validation

**Files:**
- Create: `utils/comicPanelSchema.ts`
- Create: `utils/comicPanelSchema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// utils/comicPanelSchema.test.ts
import { describe, expect, it } from 'vitest';
import {
  COMIC_LAYOUT_4A,
  COMIC_PANEL_COUNT,
  COMIC_DIALOGUE_MAX_LEN,
  createEmptyComicProject,
  createEmptyPanels,
  validatePanelsForGeneration,
  clampComicDialogue,
} from './comicPanelSchema';

describe('comicPanelSchema', () => {
  it('locks 4A layout to 2×2 with 4 panels', () => {
    expect(COMIC_LAYOUT_4A).toEqual({ preset: '4A', cols: 2, rows: 2 });
    expect(COMIC_PANEL_COUNT).toBe(4);
  });

  it('createEmptyPanels returns 4 indexed panels', () => {
    const panels = createEmptyPanels();
    expect(panels).toHaveLength(4);
    expect(panels.map((p) => p.index)).toEqual([0, 1, 2, 3]);
  });

  it('validatePanelsForGeneration requires scene text on all 4 panels', () => {
    const panels = createEmptyPanels();
    panels[0]!.sceneDescription = 'Otter waves hello';
    const result = validatePanelsForGeneration(panels);
    expect(result.ok).toBe(false);
    expect(result.missingIndices).toEqual([1, 2, 3]);
  });

  it('clampComicDialogue truncates long zh-TW dialogue', () => {
    const long = '這'.repeat(COMIC_DIALOGUE_MAX_LEN + 10);
    expect(clampComicDialogue(long).length).toBe(COMIC_DIALOGUE_MAX_LEN);
  });

  it('createEmptyComicProject defaults to 4A panels', () => {
    const project = createEmptyComicProject();
    expect(project.panels).toHaveLength(4);
    expect(project.sourceMode).toBe('concept');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- utils/comicPanelSchema.test.ts`
Expected: FAIL — cannot find module `./comicPanelSchema`

- [ ] **Step 3: Write minimal implementation**

```typescript
// utils/comicPanelSchema.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- utils/comicPanelSchema.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/comicPanelSchema.ts utils/comicPanelSchema.test.ts
git commit -m "feat(comic): add 4A panel schema and validation"
```

---

### Task 2: Extract shared character-ref prompt

**Files:**
- Create: `utils/characterRefPrompt.ts`
- Modify: `.claude/skills/line-sticker-character-ref/scripts/characterRefPrompt.ts`
- Test: existing skill still typechecks (no new test — prompt unchanged)

- [ ] **Step 1: Move prompt builder to shared utils**

Copy the full contents of `.claude/skills/line-sticker-character-ref/scripts/characterRefPrompt.ts` into `utils/characterRefPrompt.ts`, updating the import:

```typescript
import {
  STYLE_PRESETS,
  STYLE_PRESET_ORDER,
  type LineStickerStyleOption,
} from './lineStickerPresets';
```

- [ ] **Step 2: Replace skill file with re-export**

```typescript
// .claude/skills/line-sticker-character-ref/scripts/characterRefPrompt.ts
export {
  listStyleKeys,
  resolveStyleBlock,
  buildCharacterRefPrompt,
} from '../../../../utils/characterRefPrompt.ts';
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add utils/characterRefPrompt.ts .claude/skills/line-sticker-character-ref/scripts/characterRefPrompt.ts
git commit -m "refactor: extract characterRefPrompt to shared utils"
```

---

### Task 3: Extract shared character-ref image API

**Files:**
- Create: `services/gemini/characterRefImage.ts`
- Modify: `.claude/skills/line-sticker-character-ref/scripts/geminiCharacterRef.mts`

- [ ] **Step 1: Move `generateCharacterRefImage` to services**

Copy `.claude/skills/line-sticker-character-ref/scripts/geminiCharacterRef.mts` to `services/gemini/characterRefImage.ts`. Update imports:

```typescript
import { DEFAULT_MODEL } from '../../utils/constants';
import { retryOperation } from './retry';
```

Replace the local `wait` + manual retry loop with `retryOperation` from `services/gemini/retry.ts` (keep `isImageSizeRejection` fallback: retry without `imageSize` on 400). Return type stays `Promise<string>` as base64 data URL for web consistency:

```typescript
// At end of successful generation:
return `data:image/png;base64,${part.inlineData.data}`;
```

Change return type from `Uint8Array` to `string` (data URL). Update skill re-export wrapper to convert if needed:

```typescript
// geminiCharacterRef.mts — thin wrapper
import { generateCharacterRefImage } from '../../../../services/gemini/characterRefImage.ts';

export async function generateCharacterRefImageBytes(params: GenerateCharacterRefParams): Promise<Uint8Array> {
  const dataUrl = await generateCharacterRefImage(params);
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

// Keep exporting original name for skill script compatibility
export { generateCharacterRefImageBytes as generateCharacterRefImage };
export type { GenerateCharacterRefParams } from '../../../../services/gemini/characterRefImage.ts';
```

Alternatively, if skill script imports `generateCharacterRefImage` directly, update `generate-character-ref.mts` to decode data URL — pick one path and keep skill `generate.mts` working.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add services/gemini/characterRefImage.ts .claude/skills/line-sticker-character-ref/scripts/geminiCharacterRef.mts
git commit -m "refactor: extract generateCharacterRefImage to services/gemini"
```

---

### Task 4: Comic page prompt builder

**Files:**
- Create: `services/gemini/comicPagePrompt.ts`
- Create: `services/gemini/comicPagePrompt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// services/gemini/comicPagePrompt.test.ts
import { describe, expect, it } from 'vitest';
import { buildComicPagePrompt } from './comicPagePrompt';
import type { ComicPanel } from '../../utils/comicPanelSchema';

const panels: ComicPanel[] = [
  { index: 0, sceneDescription: 'Morning stretch', dialogue: '早安！' },
  { index: 1, sceneDescription: 'Spills coffee', dialogue: '糟糕…' },
  { index: 2, sceneDescription: 'Laughs it off' },
  { index: 3, sceneDescription: 'Runs to work', dialogue: '要遲到了！' },
];

describe('buildComicPagePrompt', () => {
  it('includes 2×2 layout, 1:1 aspect, and visible gutters', () => {
    const prompt = buildComicPagePrompt({
      panels,
      styleBlock: 'Chibi style, soft lines',
      characterConcept: 'Playful otter',
    });
    expect(prompt).toContain('2 columns × 2 rows');
    expect(prompt).toContain('1:1');
    expect(prompt).toMatch(/visible.*gutter|black.*border/i);
    expect(prompt).not.toContain('NO VISIBLE DIVIDERS');
  });

  it('includes all four panel scene blocks', () => {
    const prompt = buildComicPagePrompt({
      panels,
      styleBlock: 'Chibi',
      characterConcept: 'Otter',
    });
    expect(prompt).toContain('Panel 1');
    expect(prompt).toContain('Panel 4');
    expect(prompt).toContain('Morning stretch');
    expect(prompt).toContain('要遲到了');
  });

  it('locks character to attached sheet reference', () => {
    const prompt = buildComicPagePrompt({
      panels,
      styleBlock: 'Chibi',
      characterConcept: 'Otter',
    });
    expect(prompt).toMatch(/character sheet|reference sheet|do not redesign/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/gemini/comicPagePrompt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement prompt builder**

```typescript
// services/gemini/comicPagePrompt.ts
import {
  COMIC_LAYOUT_4A,
  COMIC_PANEL_COUNT,
  type ComicPanel,
} from '../../utils/comicPanelSchema';

export interface BuildComicPagePromptParams {
  panels: ComicPanel[];
  styleBlock: string;
  characterConcept: string;
}

function panelBlock(panel: ComicPanel, humanIndex: number): string {
  const dialogueLine = panel.dialogue?.trim()
    ? `- Dialogue (Traditional Chinese, speech bubble): ${panel.dialogue.trim()}`
    : '- No dialogue in this panel';
  const cameraLine = panel.cameraNote?.trim()
    ? `- Camera: ${panel.cameraNote.trim()}`
    : '';
  return `### Panel ${humanIndex}
- Scene: ${panel.sceneDescription.trim()}
${dialogueLine}
${cameraLine}`.trim();
}

export function buildComicPagePrompt(params: BuildComicPagePromptParams): string {
  const { panels, styleBlock, characterConcept } = params;
  if (panels.length !== COMIC_PANEL_COUNT) {
    throw new Error(`Expected ${COMIC_PANEL_COUNT} panels, got ${panels.length}`);
  }

  const ordered = [...panels].sort((a, b) => a.index - b.index);
  const panelSection = ordered
    .map((p, i) => panelBlock(p, i + 1))
    .join('\n\n');

  return `Generate ONE finished four-panel comic page (yonkoma / 四格漫畫).

### [Page layout — 4A]
- Exactly ${COMIC_LAYOUT_4A.cols} columns × ${COMIC_LAYOUT_4A.rows} rows = ${COMIC_PANEL_COUNT} equal panels.
- Square page, 1:1 aspect ratio.
- Reading order: left→right, top→bottom (panels 1–4).
- **Visible comic gutters**: thin black borders between panels and around the page edge.
- Do NOT use invisible grid lines. This is a printed comic page, not a sprite sheet.

### [Character lock]
The attached image is the **character model sheet**. Use ONLY that character design in every panel.
- Match face, species, palette, outfit, proportions exactly.
- Do NOT redesign, age-shift, or swap species.
- Character concept for tone: ${characterConcept.trim() || '(see sheet)'}

### [Art style]
${styleBlock}

### [Panel directions]
${panelSection}

### [Text rules]
- Dialogue must be **Traditional Chinese** when provided.
- Render dialogue in clear speech bubbles; legible at phone screen size.
- No watermark, no UI chrome, no photorealism.

Output exactly **one** complete comic page image.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/gemini/comicPagePrompt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add services/gemini/comicPagePrompt.ts services/gemini/comicPagePrompt.test.ts
git commit -m "feat(comic): add 4A page prompt builder with visible gutters"
```

---

### Task 5: Comic storyboard text service

**Files:**
- Create: `services/gemini/comicStoryboard.ts`
- Create: `services/gemini/comicStoryboard.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// services/gemini/comicStoryboard.test.ts
import { describe, expect, it } from 'vitest';
import { parseComicStoryboardJson } from './comicStoryboard';

describe('parseComicStoryboardJson', () => {
  it('parses valid JSON array of 4 panels', () => {
    const raw = JSON.stringify([
      { sceneDescription: 'A', dialogue: '嗨' },
      { sceneDescription: 'B' },
      { sceneDescription: 'C', dialogue: '嗯' },
      { sceneDescription: 'D' },
    ]);
    const panels = parseComicStoryboardJson(raw);
    expect(panels).toHaveLength(4);
    expect(panels[0]).toMatchObject({ index: 0, sceneDescription: 'A', dialogue: '嗨' });
  });

  it('strips markdown fences before parse', () => {
    const raw = '```json\n[{"sceneDescription":"X"},{"sceneDescription":"Y"},{"sceneDescription":"Z"},{"sceneDescription":"W"}]\n```';
    expect(parseComicStoryboardJson(raw)).toHaveLength(4);
  });

  it('throws when count is not 4', () => {
    expect(() => parseComicStoryboardJson('[{"sceneDescription":"only one"}]')).toThrow(/4/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/gemini/comicStoryboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement parser + generator**

```typescript
// services/gemini/comicStoryboard.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/gemini/comicStoryboard.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add services/gemini/comicStoryboard.ts services/gemini/comicStoryboard.test.ts
git commit -m "feat(comic): add storyboard JSON parser and Gemini text generator"
```

---

### Task 6: Comic character sheet + page image services

**Files:**
- Create: `utils/loadBundledImage.ts`
- Create: `reference/comic/model-sheet-layout.png` (copy from skill)
- Create: `services/gemini/comicCharacterSheet.ts`
- Create: `services/gemini/comicPage.ts`
- Modify: `services/geminiService.ts`

- [ ] **Step 1: Copy layout reference asset**

```bash
mkdir -p reference/comic
cp .claude/skills/line-sticker-character-ref/reference/model-sheet-layout.png reference/comic/model-sheet-layout.png
```

- [ ] **Step 2: Add bundled image loader**

```typescript
// utils/loadBundledImage.ts
export async function loadBundledImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load image: ${url}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}
```

- [ ] **Step 3: Implement comicCharacterSheet.ts**

```typescript
// services/gemini/comicCharacterSheet.ts
import layoutRefUrl from '../../reference/comic/model-sheet-layout.png';
import { buildCharacterRefPrompt, resolveStyleBlock } from '../../utils/characterRefPrompt';
import { loadBundledImageAsDataUrl, dataUrlToBase64 } from '../../utils/loadBundledImage';
import { generateCharacterRefImage } from './characterRefImage';
import type { ProgressCallback } from './types';

let cachedLayoutDataUrl: string | null = null;

async function getLayoutRefDataUrl(): Promise<string> {
  if (!cachedLayoutDataUrl) {
    cachedLayoutDataUrl = await loadBundledImageAsDataUrl(layoutRefUrl);
  }
  return cachedLayoutDataUrl;
}

export async function generateComicCharacterSheet(params: {
  apiKey: string;
  model: string;
  resolution: string;
  styleKey: string;
  customStyle?: string;
  characterConcept: string;
  referenceImage?: string | null;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}): Promise<string> {
  const layoutDataUrl = await getLayoutRefDataUrl();
  const prompt = buildCharacterRefPrompt({
    concept: params.characterConcept,
    styleKey: params.styleKey,
    customStyle: params.customStyle,
    characterName: undefined,
  });

  const identityBase64 = params.referenceImage
    ? dataUrlToBase64(params.referenceImage)
    : undefined;

  params.onProgress?.('正在生成角色設定圖…');

  return generateCharacterRefImage({
    apiKey: params.apiKey,
    prompt,
    layoutRefBase64: dataUrlToBase64(layoutDataUrl),
    layoutRefMimeType: 'image/png',
    identityRefBase64: identityBase64,
    identityRefMimeType: identityBase64 ? 'image/png' : undefined,
    model: params.model,
    resolution: params.resolution,
    aspectRatio: '1:1',
    onStatus: params.onProgress,
    signal: params.signal,
  });
}

export function resolveComicStyleBlock(styleKey: string, customStyle?: string): string {
  return resolveStyleBlock(styleKey, customStyle);
}
```

Note: Vite resolves `import layoutRefUrl from '...png'` as URL string. Add `/// <reference types="vite/client" />` if TS complains, or use `new URL('../../reference/comic/model-sheet-layout.png', import.meta.url).href`.

- [ ] **Step 4: Implement comicPage.ts (no chroma key)**

```typescript
// services/gemini/comicPage.ts
import { GoogleGenAI } from '@google/genai';
import { dataUrlToBase64 } from '../../utils/loadBundledImage';
import { buildComicPagePrompt } from './comicPagePrompt';
import { resolveComicStyleBlock } from './comicCharacterSheet';
import { retryOperation } from './retry';
import { API_KEY_MISSING_MESSAGE, type ProgressCallback } from './types';
import type { ComicPanel } from '../../utils/comicPanelSchema';
import { throwIfAborted } from '../../utils/abort';

export async function generateComicPage(params: {
  apiKey: string;
  model: string;
  resolution: string;
  characterSheetImage: string;
  characterConcept: string;
  styleKey: string;
  customStyle?: string;
  panels: ComicPanel[];
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}): Promise<string> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);
  throwIfAborted(params.signal);

  const styleBlock = resolveComicStyleBlock(params.styleKey, params.customStyle);
  const prompt = buildComicPagePrompt({
    panels: params.panels,
    styleBlock,
    characterConcept: params.characterConcept,
  });

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const sheetBase64 = dataUrlToBase64(params.characterSheetImage);

  params.onProgress?.('正在生成四格漫畫頁…');

  const buildConfig = (includeImageSize: boolean) => ({
    abortSignal: params.signal,
    imageConfig: {
      aspectRatio: '1:1' as const,
      ...(includeImageSize && params.resolution ? { imageSize: params.resolution } : {}),
    },
  });

  const request = (config: ReturnType<typeof buildConfig>) =>
    ai.models.generateContent({
      model: params.model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: sheetBase64 } },
          { text: prompt },
        ],
      },
      config,
    });

  let response: Awaited<ReturnType<typeof request>>;
  try {
    response = await retryOperation(
      () => request(buildConfig(true)),
      params.onProgress,
      5,
      4000,
      params.signal
    );
  } catch {
    response = await retryOperation(
      () => request(buildConfig(false)),
      params.onProgress,
      5,
      4000,
      params.signal
    );
  }

  const parts = response.candidates?.[0]?.content?.parts;
  for (const part of parts ?? []) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error('No image data received for comic page');
}
```

- [ ] **Step 5: Export from geminiService.ts**

```typescript
export { generateComicCharacterSheet, resolveComicStyleBlock } from './gemini/comicCharacterSheet';
export { generateComicStoryboard, parseComicStoryboardJson } from './gemini/comicStoryboard';
export { generateComicPage } from './gemini/comicPage';
export { buildComicPagePrompt } from './gemini/comicPagePrompt';
```

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add reference/comic/model-sheet-layout.png utils/loadBundledImage.ts services/gemini/comicCharacterSheet.ts services/gemini/comicPage.ts services/geminiService.ts
git commit -m "feat(comic): add character sheet and page image generation services"
```

---

### Task 7: useComicProject hook (state + localStorage)

**Files:**
- Create: `hooks/useComicProject.ts`

- [ ] **Step 1: Implement hook**

```typescript
// hooks/useComicProject.ts
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

  const setPanels = useCallback((panels: ComicPanel[]) => {
    patchProject({ panels });
  }, [patchProject]);

  const resetProject = useCallback(() => {
    const fresh = createEmptyComicProject();
    setProject(fresh);
    setStep(1);
    localStorage.setItem(COMIC_PROJECT_STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  return { project, step, setStep, patchProject, setPanels, resetProject };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add hooks/useComicProject.ts
git commit -m "feat(comic): add project state hook with localStorage"
```

---

### Task 8: Generation hooks

**Files:**
- Create: `hooks/useComicCharacterSheet.ts`
- Create: `hooks/useComicStoryboard.ts`
- Create: `hooks/useComicPageGeneration.ts`

- [ ] **Step 1: useComicCharacterSheet**

```typescript
// hooks/useComicCharacterSheet.ts
import { useCallback, useState } from 'react';
import { generateComicCharacterSheet } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';
import { API_KEY_MISSING_MESSAGE } from '../services/gemini/types';

export function useComicCharacterSheet(openSettings: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: {
    apiKey: string;
    model: string;
    resolution: string;
    styleKey: string;
    characterConcept: string;
    referenceImage: string | null;
  }) => {
    if (!params.apiKey) {
      openSettings();
      throw new Error(API_KEY_MISSING_MESSAGE);
    }
    if (!params.characterConcept.trim() && !params.referenceImage) {
      throw new Error('Need character concept or reference image');
    }
    setIsGenerating(true);
    setError(null);
    try {
      const image = await generateComicCharacterSheet({
        ...params,
        onProgress: setStatus,
      });
      return image;
    } catch (e) {
      const msg = getErrorMessage(e);
      setError(msg);
      throw e;
    } finally {
      setIsGenerating(false);
      setStatus(null);
    }
  }, [openSettings]);

  return { generate, isGenerating, status, error };
}
```

- [ ] **Step 2: useComicStoryboard**

```typescript
// hooks/useComicStoryboard.ts
import { useCallback, useState } from 'react';
import { generateComicStoryboard } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';
import { API_KEY_MISSING_MESSAGE } from '../services/gemini/types';
import type { ComicPanel } from '../utils/comicPanelSchema';

export function useComicStoryboard(openSettings: () => void) {
  const [isFilling, setIsFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillFromSynopsis = useCallback(async (params: {
    apiKey: string;
    characterConcept: string;
    synopsis: string;
  }): Promise<ComicPanel[]> => {
    if (!params.apiKey) {
      openSettings();
      throw new Error(API_KEY_MISSING_MESSAGE);
    }
    if (!params.synopsis.trim()) throw new Error('Synopsis required');
    setIsFilling(true);
    setError(null);
    try {
      return await generateComicStoryboard(
        params.apiKey,
        params.characterConcept,
        params.synopsis
      );
    } catch (e) {
      setError(getErrorMessage(e));
      throw e;
    } finally {
      setIsFilling(false);
    }
  }, [openSettings]);

  return { fillFromSynopsis, isFilling, error };
}
```

- [ ] **Step 3: useComicPageGeneration**

```typescript
// hooks/useComicPageGeneration.ts
import { useCallback, useState } from 'react';
import { generateComicPage } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';
import { validatePanelsForGeneration, type ComicPanel, type ComicProject } from '../utils/comicPanelSchema';
import { API_KEY_MISSING_MESSAGE } from '../services/gemini/types';

export function useComicPageGeneration(openSettings: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: {
    apiKey: string;
    model: string;
    resolution: string;
    project: ComicProject;
  }) => {
    if (!params.apiKey) {
      openSettings();
      throw new Error(API_KEY_MISSING_MESSAGE);
    }
    if (!params.project.characterSheetImage) {
      throw new Error('Character sheet required');
    }
    const validation = validatePanelsForGeneration(params.project.panels);
    if (!validation.ok) {
      throw new Error(`Missing scene on panels: ${validation.missingIndices.map((i) => i + 1).join(', ')}`);
    }

    setIsGenerating(true);
    setError(null);
    try {
      return await generateComicPage({
        apiKey: params.apiKey,
        model: params.model,
        resolution: params.resolution,
        characterSheetImage: params.project.characterSheetImage,
        characterConcept: params.project.characterConcept,
        styleKey: params.project.styleKey,
        panels: params.project.panels as ComicPanel[],
        onProgress: setStatus,
      });
    } catch (e) {
      setError(getErrorMessage(e));
      throw e;
    } finally {
      setIsGenerating(false);
      setStatus(null);
    }
  }, [openSettings]);

  const downloadPng = useCallback((dataUrl: string, filename = 'comic-page.png') => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }, []);

  return { generate, downloadPng, isGenerating, status, error };
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useComicCharacterSheet.ts hooks/useComicStoryboard.ts hooks/useComicPageGeneration.ts
git commit -m "feat(comic): add character sheet, storyboard, and page generation hooks"
```

---

### Task 9: Comic UI components

**Files:**
- Create: `components/Comic/ComicWizardSteps.tsx`
- Create: `components/Comic/ComicSourceStep.tsx`
- Create: `components/Comic/ComicCharacterSheetStep.tsx`
- Create: `components/Comic/ComicStoryboardStep.tsx`
- Create: `components/Comic/ComicResultStep.tsx`
- Create: `components/Comic/index.ts`

Follow `RemoveBackgroundPage` / `LineStickerUploadCard` Tailwind patterns: white cards, `rounded-2xl`, slate text, gradient accents (use **indigo/violet** gradient to distinguish from LINE green).

- [ ] **Step 1: ComicWizardSteps** — horizontal stepper showing steps 1–4 with active/completed states; props: `currentStep`, `labels: string[]`.

- [ ] **Step 2: ComicSourceStep** — radio toggle `upload` | `concept`; `ImageUpload` when upload; textarea for concept; props wire to `patchProject`. Require concept text OR image before enabling "Next".

- [ ] **Step 3: ComicCharacterSheetStep** — style `<select>` using `STYLE_PRESET_ORDER` + `STYLE_PRESETS` labels (same as LINE); Generate button calls `useComicCharacterSheet`; show preview image + Regenerate; block Next until `characterSheetImage` set.

- [ ] **Step 4: ComicStoryboardStep** — fixed 2×2 CSS grid preview; four cards with `sceneDescription` textarea + `dialogue` input (maxLength=`COMIC_DIALOGUE_MAX_LEN`); synopsis textarea + button 「依梗概自動填寫分鏡」 wired to `useComicStoryboard`; highlight empty panels in red when validation fails.

- [ ] **Step 5: ComicResultStep** — large `<img>` preview; Generate / Regenerate button; Download PNG button; show `status` while generating.

- [ ] **Step 6: Barrel export**

```typescript
// components/Comic/index.ts
export { ComicWizardSteps } from './ComicWizardSteps';
export { ComicSourceStep } from './ComicSourceStep';
export { ComicCharacterSheetStep } from './ComicCharacterSheetStep';
export { ComicStoryboardStep } from './ComicStoryboardStep';
export { ComicResultStep } from './ComicResultStep';
```

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: PASS (fix any unused vars)

- [ ] **Step 8: Commit**

```bash
git add components/Comic/
git commit -m "feat(comic): add wizard step UI components"
```

---

### Task 10: OnePageComicPage orchestration

**Files:**
- Create: `pages/OnePageComicPage.tsx`

- [ ] **Step 1: Implement page shell**

Pattern from `RemoveBackgroundPage.tsx`:
- Header with `Link` to `/`, `LanguageSwitcher`, Settings gear
- `useSettings` for API key / model / resolution
- `useComicProject` + three generation hooks
- `ComicWizardSteps` at top
- Render step component by `step` (1–4)
- Back / Next footer buttons; on Step 4 hide Next, show generate in `ComicResultStep`
- `SettingsModal` when API key missing
- `ErrorBoundary` optional (match other pages if present)

Step transitions:
- 1→2: require `referenceImage || characterConcept.trim()`
- 2→3: require `characterSheetImage`
- 3→4: allow proceed anytime (generation blocked until panels valid)

- [ ] **Step 2: Run dev smoke check**

Run: `npm run dev` (manual: navigate to `/one-page-comic`, verify wizard renders)
Expected: Page loads without console errors

- [ ] **Step 3: Commit**

```bash
git add pages/OnePageComicPage.tsx
git commit -m "feat(comic): add OnePageComicPage wizard orchestration"
```

---

### Task 11: Routing, home card, i18n

**Files:**
- Modify: `App.tsx`
- Modify: `pages/HomePage.tsx`
- Modify: `i18n/types.ts`, `i18n/zh-TW.ts`, `i18n/en.ts`

- [ ] **Step 1: Add lazy route in App.tsx**

```typescript
const OnePageComicPage = lazyWithRetry(() => import('./pages/OnePageComicPage'));
// ...
<Route path="/one-page-comic" element={<OnePageComicPage />} />
```

- [ ] **Step 2: Add home tool card**

In `HomePage.tsx` `tools` array, add after `line-sticker`:

```typescript
{
  id: 'one-page-comic',
  path: '/one-page-comic',
  icon: <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-white" />, // import from lucide-react
  gradient: 'from-indigo-500 to-violet-600',
  borderColor: 'border-indigo-200 hover:border-indigo-300',
  hoverGlow: 'hover:shadow-indigo-200/50',
},
```

In `getToolInfo`:

```typescript
case 'one-page-comic':
  return { title: t.comicTool, desc: t.comicDesc };
```

- [ ] **Step 3: Add i18n keys to types.ts**

```typescript
  // One-Page Comic
  comicTool: string;
  comicDesc: string;
  comicTitle: string;
  comicStepSource: string;
  comicStepSheet: string;
  comicStepStoryboard: string;
  comicStepGenerate: string;
  comicSourceUpload: string;
  comicSourceConcept: string;
  comicConceptLabel: string;
  comicConceptPlaceholder: string;
  comicStyleLabel: string;
  comicGenerateSheet: string;
  comicRegenerateSheet: string;
  comicSynopsisLabel: string;
  comicSynopsisPlaceholder: string;
  comicFillStoryboard: string;
  comicPanelSceneLabel: string;
  comicPanelDialogueLabel: string;
  comicGeneratePage: string;
  comicDownloadPng: string;
  comicErrorNeedConcept: string;
  comicErrorNeedSheet: string;
  comicErrorNeedPanels: string;
  comicNext: string;
  comicBack: string;
```

- [ ] **Step 4: zh-TW translations**

```typescript
  comicTool: '一頁式漫畫',
  comicDesc: '上傳角色或描述概念，生成設定圖與四格分鏡，輸出單頁漫畫 PNG。',
  comicTitle: '一頁式漫畫',
  comicStepSource: '角色來源',
  comicStepSheet: '設定圖',
  comicStepStoryboard: '分鏡',
  comicStepGenerate: '生成頁面',
  comicSourceUpload: '上傳參考圖',
  comicSourceConcept: '文字概念',
  comicConceptLabel: '角色概念',
  comicConceptPlaceholder: '描述角色外觀與個性，例如：圓潤奶油色水獺，頑皮愛撒嬌…',
  comicStyleLabel: '畫風',
  comicGenerateSheet: '生成設定圖',
  comicRegenerateSheet: '重新生成',
  comicSynopsisLabel: '故事梗概',
  comicSynopsisPlaceholder: '一句話描述四格故事，例如：早上趕著出門卻一路出包…',
  comicFillStoryboard: '依梗概自動填寫分鏡',
  comicPanelSceneLabel: '畫面描述',
  comicPanelDialogueLabel: '台詞（繁體中文，選填）',
  comicGeneratePage: '生成漫畫頁',
  comicDownloadPng: '下載 PNG',
  comicErrorNeedConcept: '請上傳圖片或填寫角色概念',
  comicErrorNeedSheet: '請先生成設定圖',
  comicErrorNeedPanels: '請填寫四格畫面描述',
  comicNext: '下一步',
  comicBack: '上一步',
```

- [ ] **Step 5: en.ts** — mirror keys in English.

- [ ] **Step 6: Wire `t.comic*` in all Comic components**

- [ ] **Step 7: Run CI**

Run: `npm run ci`
Expected: typecheck + lint + test + build all PASS

- [ ] **Step 8: Commit**

```bash
git add App.tsx pages/HomePage.tsx i18n/ pages/OnePageComicPage.tsx components/Comic/
git commit -m "feat(comic): add route, home card, and i18n for one-page comic"
```

---

### Task 12: Manual E2E verification

**Files:** none (manual)

- [ ] **Step 1: With valid API key in Settings**

1. Home → 一頁式漫畫
2. Concept mode → enter otter concept → Next
3. Select `chibi` → Generate sheet → accept preview → Next
4. Enter synopsis → 依梗概自動填寫分鏡 → verify 4 panels filled → Next
5. Generate page → verify 2×2 comic with visible gutters → Download PNG

- [ ] **Step 2: Verify localStorage restore**

Refresh browser → project state restored at same step.

- [ ] **Step 3: Document in PR description**

Note manual test date + model used.

---

## Self-Review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Route `/one-page-comic` | Task 11 |
| Home tool card | Task 11 |
| 4-step wizard | Tasks 9–10 |
| 4A only (2×2) | Tasks 1, 4 |
| Single Gemini image per page | Task 6 (`comicPage.ts`) |
| Character design sheet | Tasks 3, 6, 8 |
| Storyboard + AI fill | Tasks 5, 8, 9 |
| Visible comic gutters | Task 4 |
| Reuse STYLE_PRESETS, settings, retry | Tasks 2–8 |
| Separate `comicStoryboard` (not animation) | Task 5 |
| localStorage persistence | Task 7 |
| PNG download | Tasks 8, 9 |
| Unit tests (schema, prompt, storyboard) | Tasks 1, 4, 5 |
| zh-TW dialogue | Tasks 4, 5, 11 |
| No chroma key on page | Task 6 (explicit) |
| Phase 2/3 deferred | Not in plan ✓ |

**Placeholder scan:** No TBD/TODO steps.

**Type consistency:** `ComicPanel.index` 0–3 throughout; `COMIC_PANEL_COUNT === 4`; `aspectRatio: '1:1'` in schema meta and API calls.

---

## Out of Scope (do not implement in this plan)

- 12-panel or layout picker
- Panel ZIP / slice export
- `sheetGridValidation` retry
- Headless `one-page-comic-maker` skill
- `ProjectHistory` integration
- Drag reorder panels
