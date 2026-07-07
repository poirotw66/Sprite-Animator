---
name: line-sticker-maker
description: Generate a complete LINE sticker set from a single character reference image, fully headless (no browser). Produces sprite sheets via Gemini, slices stickers, and packages output for the repo-local upload workflow (or legacy line-upload.zip). Use when the user wants to "make LINE stickers", "produce a sticker set", "生成貼圖 / 做一套貼圖" from a reference image.
---

# LINE Sticker Maker

Headless version of this project's LINE sticker workflow. Given one character
reference image, it generates sprite sheets with Gemini, removes the chroma-key
background, slices individual transparent sticker PNGs, and packages the result
for the **repo-local upload workflow** (preferred) or legacy LINE Creators Market ZIP — all from
the command line, no browser/UI.

It **reuses the app's own modules** (`utils/lineStickerPrompt.ts`,
`utils/lineStickerSetSchema.ts`, `utils/chromaKeyCore.ts`,
`utils/lineStickerUploadSpec.ts`) so output matches the web app.

## How to run

**Simplest (image + phrase-set JSON):** use the pipeline wrapper — see
**`.claude/skills/line-sticker-pipeline/SKILL.md`**.

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set path/to/phrases.json \
  --out output/my-set
```

**Full control (job config):**

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/generate.mts \
  --config <path/to/config.json> \
  --out <output-dir>
```

When `lineS` is present, the upload pack is written **into the job `--out` folder**
(under `.claude/skills/line-sticker-maker/example/output/pX/`). No `root` needed.

```bash
npx tsx .../generate.mts \
  --config example/p4-job.config.json \
  --out .claude/skills/line-sticker-maker/example/output/p4
```
- `--dry-run` prints the assembled prompt + phrase list per sheet (no API, no files).
- Gemini API key: `GEMINI_API_KEY` env var, else repo `.env` / `.env.local`.
- Run from the repo root.

### Regenerate one sheet (isolated)

```bash
npx tsx .../generate.mts --config job.json --out output/p3 \
  --sheet sheet-1 --sheet-dir sheet-1-v2
```

Then merge and repack (updates `activeSheets` in manifest):

```bash
npx tsx .../finalize.mts --out output/p3 --config job.json \
  --sheets sheet-1-v2,sheet-2
```

`--sheets` accepts comma **or** semicolon (Windows-safe). Omit `--sheets` to
use `manifest.json` → `activeSheets`, or fall back to `sheet-1`, `sheet-2`.

## Agent workflow

1. **Gather inputs** (ask only for what's missing):
   - reference image path
   - `phraseSetFile` or custom phrases
   - `lineS.setName` + zh/en titles & descriptions
2. **Write `config.json`** from `config.example.json`.
3. **`--dry-run`** to verify prompt + phrases.
4. **Run for real** → one command produces debug output + repo-local upload folder.
5. **Spot-check** a few `stickers/sticker-NN.png` and `manifest.json` grid scores.
6. Tell the user the **`--out` folder** and, when `syncToLineS` is on, the synced
   **`.line-upload/input/706/{Set Name}/`** path + upload command.

## Upload to LINE Creators Market

Upload scripts live under `.claude/skills/line-sticker-upload/`.
See **`.claude/skills/line-sticker-upload/SKILL.md`** for Drive / Playwright setup.

### Environment files (two layers)

| File | Purpose | When |
|------|---------|------|
| `.claude/skills/line-sticker-maker/credentials.env` | Shared account secrets (`LINE_EMAIL`, `LINE_PASSWORD`, `LINE_CREATOR_ID`, Google Drive parent) | **Once** — copy from `credentials.env.example` |
| `<out>/.env.batch/{Set_Name}.env` | Per-set titles, paths, runtime IDs (`LINE_STICKER_ID`, `GDRIVE_*`) | **Auto** — written by `generate` / `finalize` / `sync-upload-input` |
| Repo `.env` / `.env.local` | `GEMINI_API_KEY` only (image generation) | Optional |

`run-line-upload.mts` **merges `credentials.env` into the batch file** before each step.
You do not copy secrets into `.env.batch` by hand.

```bash
cp .claude/skills/line-sticker-maker/credentials.env.example \
   .claude/skills/line-sticker-maker/credentials.env
# fill LINE_EMAIL, LINE_PASSWORD, LINE_CREATOR_ID, GOOGLE_*

npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts \
  --env output/my-set/.env.batch/My_Set_Name.env
```

After `generate.mts` / `finalize.mts`, if `lineS.syncToLineS` is not disabled,
the pack is copied to `.line-upload/input/706/{Set Name}/` and the batch env stays
under `<out>/.env.batch/`.

## config.json fields

| field | default | notes |
|---|---|---|
| `referenceImage` | — | character reference (png/jpg/webp). Resolved relative to config file, cwd, or repo root. |
| `phraseSetFile` | — | load phrases + actionDescs from a phrase-set JSON (recommended). |
| `characterDescription` | `""` | optional extra notes for character rules |
| `style` | `matchUploaded` | preset key: `chibi`, `pixel`, `watercolor`, etc. |
| `theme` | `daily` | used when `customPhrases` is empty |
| `customPhrases` | `[]` | overrides theme phrases when non-empty |
| `language` | `zh-TW` | `zh-TW`, `zh-CN`, `en`, `ja` |
| `chromaKeyColor` | `green` | `magenta` or `green` |
| `includeText` | `true` | when `textRendering` is `model`, Gemini draws phrase text |
| `textRendering` | `model` | **`model`** = Gemini draws text on stickers (skill default); `programmatic` = canvas overlay after slice (more stable zh-TW) |
| `fontKey` / `textColorKey` | `round` / `black` | used when `textRendering` is `programmatic` |
| `scope` | `set` | `set` = full LINE set; `single` = one sheet |
| `stickerCount` | `40` | 40 = 2×4×5 (LINE standard); 48 = legacy 3×4×4 |
| `model` | `gemini-3.1-flash-image` | skill default (`DEFAULT_SKILL_STICKER_MODEL`); character-ref still uses flash-lite |
| `resolution` | `1K` | `0.5K`/`1K`/`2K`/`4K` (model-dependent) |
| `maxSheetRetries` | `3` | Gemini retries when grid validation fails |
| `minGridAlignmentScore` | `0.72` | 0–1; reject sheet below this score |
| `promptVersion` | `v3compact` | `v3compact` = shorter per-cell lines; `v3` = verbose legacy |
| `styleAnchorFromPriorSheet` | `false` | opt-in: attach sheet-1 `_processed-sheet.png` for sheet-2+ (forces sequential) |
| `qaEnabled` | `true` | write `qa-report.json` at finalize (warn-only) |
| `lineUpload` | `true` | build upload ZIP at end of full run |
| `mainStickerIndex` / `tabStickerIndex` | `1` | 1-based indices for shop images |
| **`lineS`** | — | **repo-local upload layout (recommended)** |

### `lineS` block

| field | notes |
|---|---|
| `enabled` | default `true` when block is present |
| `root` | **optional** — external upload root. Omit to pack into `--out` (recommended). |
| `creatorId` | used in `.env.batch` paths (default `706`) |
| `setName` | English ZIP / MD base name, e.g. `Cozy Cream Cat Daily Chat` |
| `titleZh` / `descZh` | Traditional Chinese shop listing |
| `titleEn` / `descEn` | English shop listing |
| `writeEnvBatch` | default `true`; writes `<out>/.env.batch/{Set_Name}.env` |
| `syncToLineS` | default `true`; copies pack to repo-local upload root |
| `uploadRoot` | upload root path (default `.line-upload`) |

When `lineS` is enabled (default), **`generate.mts` writes the upload pack into `--out`**
and optionally syncs to **`.line-upload/input/706/{Set Name}/`**:

```
.claude/skills/line-sticker-maker/example/output/p4/
  sheet-1/                          ← debug slices
  sheet-2/
  stickers/                         ← flat 40 PNGs
  manifest.json                     ← activeSheets, gridScores
  Cozy Cream Cat Daily Chat.zip     ← ★ LINE upload ZIP (42 PNGs)
  Cozy Cream Cat Daily Chat.md
  sprite_sheets/
    sprite_sheet_1_transparent.png
    sprite_sheet_2_transparent.png
  .env.batch/
    Cozy_Cream_Cat_Daily_Chat.env

.line-upload/input/706/Cozy Cream Cat Daily Chat/   ← auto-sync when syncToLineS
  (zip, md, sprite_sheets only — batch env stays in --out)
```

Without `lineS`, legacy output is `<out>/line-upload/` + `line-upload.zip`.

## Scripts

| script | purpose |
|---|---|
| `generate.mts` | full pipeline: Gemini → slice → finalize → sync upload root |
| `finalize.mts` | merge `activeSheets` → stickers + upload pack + sync |
| `sync-line-upload-input.mts` | copy local pack → `.line-upload/input/706/` |
| `run-line-upload.mts` | run Drive + Playwright upload pipeline |
| `reslice-sheet.mts` | re-slice existing `_processed-sheet.png` (no Gemini) |
| `stickerQa` (via finalize) | auto `qa-report.json` — foreground, size, text, LINE limits |
| `organize-line-upload-input.mts` | standalone pack into upload layout (fallback) |
| `rebuild-line-upload.mts` | legacy only; prefer `finalize.mts` |

## manifest.json

After a full run or `finalize.mts`:

```json
{
  "activeSheets": ["sheet-1", "sheet-2"],
  "gridScores": { "sheet-1": 0.85, "sheet-2": 0.84 },
  "qaReport": { "overallScore": 0.91, "pass": true, "summaryWarnings": [] },
  "lineSDest": ".../example/output/p4",
  "stickers": [ ... ]
}
```

## Notes / limits

- Sprite sheets: **1:1 @ 1K → 1024×1024 px** (4×5 → ~256×204 px per cell).
- Upload PNGs are scaled to LINE limits; `stickers/` keeps native resolution.
- 40-sticker set = **2 Gemini calls in parallel** (both sheets use the same character reference image only).
- **v3compact** prompts: `N|"phrase"|action` per cell (~25% shorter than v3).
- Grid validation **hard-rejects** wrong layout (e.g. 5×5 instead of 4×5) and uneven column widths.
- **Best attempt** kept across retries; **reslice-before-regenerate** accepts marginal scores (0.68–0.72) without a new API call when layout matches.
- Gemini **empty-image response** is retried up to 3 times before failing.
- Grid prompt includes `[0. GRID LAYOUT]` anchor to reduce 5×5 drift.
- Not included: LINE account setup, review, or pricing.
