# One-Page Comic Module Design

Date: 2026-07-09  
Project: Sprite-Animator  
Scope: New web module — upload character → character design sheet → storyboard → one-page comic

## 1. Problem Statement

Users want a browser workflow to produce a **single-page comic** from a character: upload or describe a character, generate a **model sheet** (設定圖), configure **storyboard panels**, then generate one downloadable comic page.

Today the repo supports sprite animation, LINE stickers, background removal, and slicing — plus headless **character reference** generation — but there is no web entry for comic creation and no comic-specific storyboard or page-layout prompts.

## 2. Locked Product Decisions (from stakeholder)

| Code | Meaning | Grid | Panels | Use case |
|------|---------|------|--------|----------|
| **4A** | Four-panel page, uniform grid | **2×2** | 4 | Yonkoma / 四格梗圖、短情境 |

**Generation approach:** **A — single Gemini image per page** (one API call per page, same pattern as LINE sprite sheets). No per-panel compose in MVP.

MVP supports **only 4A** — fixed 2×2 layout, no layout picker. Other grid sizes (e.g. 12-panel) are out of scope for v1 and deferred to a future phase if needed.

## 3. Objectives and Non-Objectives

### Objectives

1. New home tool card + route `/one-page-comic`.
2. Four-step wizard: **Upload → Character sheet → Storyboard → Generate page**.
3. Reuse Gemini API, settings, `STYLE_PRESETS`, retry, and error patterns from existing pages.
4. Fixed layout: **4A (2×2)** only — four panels per page.
5. Download final page as PNG; optional panel ZIP in Phase 2.

### Non-Objectives (v1)

- 12-panel or other multi-grid layouts
- Layout preset picker
- Multi-page comics or series
- Free-form irregular panel shapes (manga irregular layouts)
- PDF export, print bleed, CMYK
- LINE upload / sticker pipeline integration
- Animation or video output
- Cloud sync or multi-user editing
- Headless CLI skill (Phase 3)

## 4. User Flow

```
Home → One-Page Comic
  │
  ├─ Step 1 · Character source
  │    · Upload reference image (lock appearance)
  │    OR text-only concept (generate from scratch)
  │
  ├─ Step 2 · Character design sheet
  │    · Style preset (STYLE_PRESETS)
  │    · Optional layout reference (default: model-sheet-layout.png)
  │    · Generate → preview → accept / regenerate
  │
  ├─ Step 3 · Storyboard (fixed 4A · 2×2)
  │    · Four panels: scene description + optional dialogue (zh-TW)
  │    · Optional: AI fill all 4 panels from a one-line synopsis (Gemini text)
  │    · Reorder / edit inline (drag reorder = Phase 2)
  │
  └─ Step 4 · Generate comic page
       · Single full-page image (2×2)
       · Preview, zoom, download PNG
       · (Phase 2) slice panels + ZIP
```

### Success criteria (MVP)

- Same character reads consistently across all 4 panels.
- Dialogue in Traditional Chinese when provided; readable in preview.
- Exactly 4 panels with visible comic gutters (unlike LINE stickers).
- User can complete flow without CLI.

## 5. Architecture

### 5.1 High-level pipeline

```
referenceImage | concept
       ↓
comicCharacterSheet (Gemini image) → characterSheetImage
       ↓
comicStoryboard (Gemini text, optional) + manual edits → panels[4]
       ↓
comicPagePrompt (4A layout + panels + sheet ref) → comicPage (Gemini image)
       ↓
preview + download (+ optional slice in Phase 2)
```

### 5.2 Module boundaries

| Layer | Responsibility |
|-------|----------------|
| `pages/OnePageComicPage.tsx` | Route, wizard orchestration, layout |
| `components/Comic/*` | Step UI (upload, sheet, storyboard, result) |
| `hooks/useComicProject.ts` | Project state machine, localStorage |
| `hooks/useComicCharacterSheet.ts` | Sheet generation |
| `hooks/useComicStoryboard.ts` | Panel CRUD, AI fill |
| `hooks/useComicPageGeneration.ts` | Full page generation |
| `services/gemini/comicCharacterSheet.ts` | Prompt + API for model sheet |
| `services/gemini/comicStoryboard.ts` | Comic panel text (≠ animation `storyboard.ts`) |
| `services/gemini/comicPagePrompt.ts` | Page layout + per-panel blocks |
| `services/gemini/comicPage.ts` | Single page image call |
| `utils/comicPanelSchema.ts` | Types, fixed 4A constants, validation |

**Reuse (do not fork logic):**

- `STYLE_PRESETS`, `lineStickerPresets.ts` for style keys
- Page aspect **1:1** for 2×2 square cells (same as 4×4 LINE sheet on square canvas)
- `normalizeBackgroundColor` + `processChromaKey` only if we add transparent-panel export later (not MVP)
- `ImageUpload`, `SettingsModal`, `LanguageSwitcher`, `ErrorBoundary`
- Headless `line-sticker-character-ref` prompts → extract to shared module when implementing

**Do not extend:**

- `services/gemini/storyboard.ts` (animation keyframes) — comic storyboard is a separate module.

## 6. Layout Preset (4A only)

### 4A — 2×2 (four panels)

| Property | Value |
|----------|--------|
| cols × rows | 2 × 2 |
| Panel count | 4 (fixed) |
| Target aspect | **1:1** square page (cells ~square) |
| Gemini `aspectRatio` | `1:1` |
| Typical resolution | 1K (1024×1024) |

No layout selection UI in MVP — schema and prompts hard-code 4A.

### Comic gutters vs LINE stickers

LINE stickers require **invisible** logical grid lines. Comics require **visible panel borders** (thin black gutters). Page prompt must use a **separate template** — do not reuse LINE `NO VISIBLE DIVIDERS` rules.

## 7. Data Model

```typescript
/** MVP: only 4A is supported. */
const COMIC_LAYOUT_4A = { preset: '4A' as const, cols: 2, rows: 2 };

interface ComicPanel {
  index: number;              // 0–3, reading order L→R, T→B
  sceneDescription: string;   // visual direction for image model
  dialogue?: string;          // zh-TW, optional
  cameraNote?: string;        // optional: close-up, wide, etc.
}

interface ComicProject {
  id: string;
  createdAt: number;
  updatedAt: number;

  // Step 1
  sourceMode: 'upload' | 'concept';
  referenceImage: string | null;
  characterConcept: string;

  // Step 2
  styleKey: string;           // STYLE_PRESETS key
  characterSheetImage: string | null;

  // Step 3 — layout is always 4A
  synopsis?: string;          // for AI fill
  panels: ComicPanel[];       // length must be 4

  // Step 4
  pageImage: string | null;
  generationMeta?: {
    model: string;
    aspectRatio: '1:1';
    resolution: string;
  };
}
```

**Persistence (MVP):** `localStorage` key `comic-project-v1`; optional export/import `comic-project.json`.

**Validation:**

- `panels.length` must be **4** before generate.
- `dialogue` clamped (e.g. max 40 chars per panel — tune in implementation).
- All user-facing Chinese: **Traditional Chinese only**.

## 8. Prompt Strategy (summary)

### 8.1 Character design sheet

Align with headless `line-sticker-character-ref`:

- Input: concept and/or uploaded reference + `STYLE_PRESETS` + layout reference image.
- Output: single model sheet PNG (turnaround, expressions, details).
- Model: `gemini-3.1-flash-image` (or app default image model).

### 8.2 Comic storyboard (text)

- Model: `gemini-2.5-flash` or `gemini-3.1-flash-lite` (text).
- Input: character concept + synopsis + **fixed panel count 4**.
- Output: JSON array of exactly 4 `{ sceneDescription, dialogue? }` entries.
- Language: scene descriptions English or zh-TW (pick one in impl; dialogue zh-TW).

### 8.3 Comic page (image)

- Model: `gemini-3.1-flash-image`.
- Inputs: **character sheet image** (required) + assembled prompt.
- Prompt sections:
  1. **Page layout** — 2×2, 1:1 aspect, visible black gutters.
  2. **Character lock** — only character(s) from sheet; no redesign.
  3. **Per-panel block** — panels 1–4, scene, dialogue placement hint.
  4. **Style** — from preset.
- Post-process: none in MVP (no chroma key on comic page).

## 9. UI / Routing

| Item | Value |
|------|--------|
| Route | `/one-page-comic` |
| Home card id | `one-page-comic` |
| Lazy import | `OnePageComicPage` in `App.tsx` |
| i18n prefix | `comic*` keys in `zh-TW.ts` / `en.ts` |

Step 3 UI highlights:

- Fixed **2×2** grid preview (no layout toggle).
- Four editable panel cards (scene + dialogue).
- Button: 「依梗概自動填寫分鏡」

## 10. Error Handling

| Failure | UX |
|---------|-----|
| Missing API key | Open settings modal (same as LINE page) |
| Sheet generation failed | Retry + show message |
| Fewer than 4 panels filled | Block generate; highlight empty panels |
| Page generation empty | Retry with backoff (reuse `retry.ts`) |
| Quota / 429 | User-friendly message |

## 11. Testing (MVP)

| Test | Scope |
|------|--------|
| `comicPanelSchema.test.ts` | 4A dimensions, exactly 4 panels |
| `comicPagePrompt.test.ts` | Prompt contains 2×2, panel text, gutter rules |
| `comicStoryboard.test.ts` | JSON parse / enforce length 4 |
| Manual | E2E happy path 4A with real API key |

No screenshot regression tests in v1.

## 12. Implementation Phases

### Phase 1 — MVP (this spec)

- Route + wizard shell
- Steps 1–4 for **4A only**
- Single-image page generation
- PNG download
- localStorage project save

### Phase 2

- Grid alignment score + retry (adapt `sheetGridValidation`)
- Per-panel regenerate + paste into page (hybrid approach C)
- Slice 4 panels → ZIP
- `ProjectHistory` integration
- Drag reorder panels

### Phase 3

- Headless skill `one-page-comic-maker`
- Optional: additional layout presets (e.g. 12-panel) if product requests
- Synopsis templates (日常四格, etc.)

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Character drift across panels | Always attach character sheet; strong lock prompt |
| Wrong panel count from model | UI enforces 4 panels; validate before API |
| Text garbled / simplified Chinese | zh-TW constraints + optional QA |
| Confusion with animation storyboard | Separate `comicStoryboard` naming and docs |

## 14. Open Items (deferred)

- Exact dialogue length limit per panel (tune after first samples).
- Whether Step 1 upload is required when concept-only (allow concept-only for sheet gen).
- Panel slice inset for gutter crop (Phase 2).
- Multi-grid layouts such as 12-panel (explicitly deferred; not in MVP).

---

**Status:** Draft v2 — **4A only** (2×2); generation **Approach A** (single page image). Ready for implementation plan (`writing-plans`).
