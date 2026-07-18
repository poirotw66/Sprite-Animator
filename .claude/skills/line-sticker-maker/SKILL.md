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

### Additive: ChatGPT paper-bg sheets (V2)

For **light-paper** 4×5 sheets (not Gemini green chroma), use the Python V2
converter — it does **not** replace `legacy`/`core`/`forge` or TS slice modes:

```bash
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --sheet path/to/4x5.png --out output/my-set
```

See [docs/workflows/sheet-converter-v2.md](../../../docs/workflows/sheet-converter-v2.md).

## How to run

**Simplest (image + phrase-set JSON):** see [docs/workflows/line-sticker-pipeline.md](../../../docs/workflows/line-sticker-pipeline.md) or `line-sticker-pipeline` skill.

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set .claude/skills/line-sticker-phrase-design/example/daily-set-40.json \
  --out output/my-set
```

**Full control (job config):**

```bash
npx tsx scripts/line-sticker/generate.mts \
  --config .claude/skills/line-sticker-maker/examples/demo-job.config.json \
  --out output/my-set
```

Place `reference-image.png` beside the job config or set `referenceImage` to your ref path.

When `upload` is present, the upload pack is written **into the job `--out` folder**.
No `root` needed.

- `--dry-run` prints the assembled prompt + phrase list per sheet (no API, no files).
- Gemini API key: `GEMINI_API_KEY` env var, else repo `.env` / `.env.local`.
- Run from the repo root.

### Regenerate one sheet (isolated)

```bash
npx tsx .../generate.mts --config job.json --out output/my-set \
  --sheet sheet-1 --sheet-dir sheet-1-v2
```

Then merge and repack (updates `activeSheets` in manifest):

```bash
npx tsx .../finalize.mts --out output/my-set --config job.json \
  --sheets sheet-1-v2,sheet-2
```

`--sheets` accepts comma **or** semicolon (Windows-safe). Omit `--sheets` to
use `manifest.json` → `activeSheets`, or fall back to `sheet-1`, `sheet-2`.

## Agent workflow

1. **Gather inputs** (ask only for what's missing):
   - reference image path
   - `phraseSetFile` or custom phrases
   - `upload.setName` + zh/en titles & descriptions
2. **Write `config.json`** from `config.example.json` or `examples/demo-job.config.json`.
3. **`--dry-run`** to verify prompt + phrases.
4. **Run for real** → one command produces debug output + repo-local upload folder.
5. **Spot-check** a few `stickers/sticker-NN.png` and `manifest.json` grid scores.
   Read `qa-report.json` → `pocketGreenCount` / `oliveFringeCount` per sticker (`edgeGreenCount` is debug-only).
6. Tell the user the **`--out` folder** and, when `syncToUploadRoot` is on, the synced
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

npx tsx scripts/line-sticker/run-line-upload.mts \
  --env output/my-set/.env.batch/My_Set_Name.env
```

After `generate.mts` / `finalize.mts`, if `upload.syncToUploadRoot` is not disabled,
the pack is copied to `.line-upload/input/706/{Set Name}/` and the batch env stays
under `<out>/.env.batch/`.

Legacy job configs with `lineS` / `syncToLineS` are still accepted when reading.

## config.json fields

The table below is the production preset used by both `run-from-inputs.mts` and
`generate.mts`. Explicit job config fields still override these values.

| field | default | notes |
|---|---|---|
| `referenceImage` | — | character reference (png/jpg/webp). Resolved relative to config file, cwd, or repo root. |
| `phraseSetFile` | — | load phrases + actionDescs from a phrase-set JSON (recommended). |
| `characterDescription` | `""` | optional extra notes for character rules |
| `style` | `matchUploaded` | preset key: `chibi`, `pixel`, `watercolor`, etc. |
| `theme` | `daily` | used when `customPhrases` is empty |
| `customPhrases` | `[]` | overrides theme phrases when non-empty |
| `language` | `zh-TW` | `zh-TW`, `zh-CN`, `en`, `ja` |
| `chromaKeyColor` | `auto` | scans all character references and selects the less-conflicting `green` or `magenta`; explicit colors remain supported |
| `chromaKeyAlgorithm` | `core` | production default; `legacy` and `forge` remain explicit compatibility options |
| `includeText` | `true` | include the phrase in the final sticker |
| `textRendering` | `programmatic` | canvas overlay after slicing; use `model` only when model-drawn lettering is intentional |
| `fontKey` / `textColorKey` | `round` / `black` | deterministic caption styling |
| `programmaticCompose.enabled` | `true` | keeps caption and character in separate layout slots |
| `scope` | `set` | `set` = full LINE set; `single` = one sheet |
| `stickerCount` | `40` | 40 = 2×4×5 (LINE standard); 48 = legacy 3×4×4 |
| `model` | `gemini-3.1-flash-image` | skill default (`DEFAULT_SKILL_STICKER_MODEL`) |
| `resolution` | `2K` | `0.5K`/`1K`/`2K`/`4K` (model-dependent; default `2K` for flash-image) |
| `maxSheetRetries` | `3` | maximum Gemini attempts per sheet |
| `extraSheetRegenAttempts` | `0` | prevents an implicit second retry budget |
| `minGridAlignmentScore` | `0.8` | 0–1; reject sheet below this score |
| `promptVersion` | `v3compact` | `v3compact` = shorter per-cell lines; `v3` = verbose legacy |
| `styleAnchorFromPriorSheet` | `true` | attach sheet-1 `_processed-sheet.png` for sheet-2+ to stabilize identity; sheets run sequentially |
| `gridTemplate` | `"guided"` | visible layout reference used by supported Gemini image models, including flash-image |
| `qaEnabled` | `true` | write `qa-report.json` at finalize (warn-only) |
| `lineUpload` | `true` | build upload ZIP at end of full run |
| `mainStickerIndex` / `tabStickerIndex` | random | optional 1-based overrides; default picks two distinct stickers from the set |
| **`upload`** | — | **repo-local upload layout (recommended)** |

### `upload` block

| field | notes |
|---|---|
| `enabled` | default `true` when block is present |
| `root` | **optional** — external upload root. Omit to pack into `--out` (recommended). |
| `creatorId` | used in upload input paths (default `706`) |
| `setName` | English ZIP / MD base name, e.g. `Cozy Cream Cat Daily Chat` |
| `titleZh` / `descZh` | Traditional Chinese shop listing (auto-fit: title ≤20, desc ≤80). Omit `descZh` to auto-build from phrase hooks. **Never** put pipeline labels like `（模型繪字版）` in shop copy — they are stripped automatically. |
| `titleEn` / `descEn` | English listing (title &lt;40 ASCII, desc ≤160). Omit `descEn` for auto-build. Avoid internal set names like `Model Text Set` — use shopper-facing names (`Playful Chat`, `Daily Banter`). |
| `writeEnvBatch` | default `true`; writes `<out>/.env.batch/{Set_Name}.env` |
| `syncToUploadRoot` | default `true`; copies pack to `.line-upload/input/706/` |
| `uploadRoot` | upload root path (default `.line-upload`) |

When `upload` is enabled (default), **`generate.mts` writes the upload pack into `--out`**
and optionally syncs to **`.line-upload/input/706/{Set Name}/`**:

```
output/my-set/
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

.line-upload/input/706/Cozy Cream Cat Daily Chat/   ← auto-sync when syncToUploadRoot
  (zip, md, sprite_sheets only — batch env stays in --out)
```

Without `upload`, legacy output is `<out>/line-upload/` + `line-upload.zip`.

## Scripts

| script | purpose |
|---|---|
| `daily-pack.mts` | daily 30-set factory (plan / execute / registry) |
| `backfill-sticker-registry.mts` | scan `output/` → `sticker-registry.json` |
| `generate.mts` | full pipeline: Gemini → slice → finalize → sync upload root |
| `finalize.mts` | merge `activeSheets` → stickers + upload pack + sync |
| `sync-upload-input.mts` | copy local pack → `.line-upload/input/706/` |
| `run-line-upload.mts` | run Drive + Playwright upload pipeline |
| `reslice-sheet.mts` | re-slice existing `_raw-sheet.jpg` (no Gemini) |
| `reoverlay-sheet.mts` | re-apply programmatic text after reslice |
| `stickerQa` (via finalize) | auto `qa-report.json` — foreground, size, text, LINE limits, **green fringe** |
| `organize-line-upload-input.mts` | standalone pack into upload layout (fallback) |

### Re-slice after chroma changes (no Gemini)

```bash
npx tsx scripts/line-sticker/reslice-sheet.mts <out>/sheet-1 4 5 template
npx tsx scripts/line-sticker/reoverlay-sheet.mts <out>/sheet-1 4 5 \
  --phrases <out>/phrase-set.json --offset 0
npx tsx scripts/line-sticker/reslice-sheet.mts <out>/sheet-2 4 5 template
npx tsx scripts/line-sticker/reoverlay-sheet.mts <out>/sheet-2 4 5 \
  --phrases <out>/phrase-set.json --offset 20
npx tsx scripts/line-sticker/finalize.mts \
  --out <out> --config <out>/job.config.json
```

### Chroma safety (guided chroma)

- `auto` scores green and magenta conflicts in the character reference, then uses the safer key.
- **Do** clear enclosed key-color pockets using the selected chroma-distance threshold.
- **Do not** alpha-erase neutral gray / black line AA (`RGB spread < 12`) — original ink.
- **Do not** use neutral-gray protrusion cleanup — it deletes speed lines / outlines.
- `reslice-sheet.mts` reads resolved chroma and algorithm from `manifest.json` / `job.config.json`; `--chroma` remains an explicit override.
- `qa-report.json` fields retain the legacy names `edgeGreenCount`, `pocketGreenCount`, `oliveFringeCount`.

## manifest.json

After a full run or `finalize.mts`:

```json
{
  "activeSheets": ["sheet-1", "sheet-2"],
  "gridScores": { "sheet-1": 0.85, "sheet-2": 0.84 },
  "qaReport": { "overallScore": 0.91, "pass": true, "summaryWarnings": [] },
  "uploadPackPath": "output/my-set",
  "uploadSyncPath": ".line-upload/input/706/Cozy Cream Cat Daily Chat",
  "uploadEnvFile": "output/my-set/.env.batch/Cozy_Cream_Cat_Daily_Chat.env",
  "stickers": [ ... ]
}
```

## Notes / limits

- Background normalization + chroma key use the **same shared rules** as the web app (`normalizeChromaBackground` → `processChromaKey`).
- **Guided green pocket cleanup** (Pass 5): clears enclosed `G > max(R,B)` pockets only; never touches neutral gray / black line AA.
- Sprite sheets: production default **1:1 @ 2K** when supported; unsupported models fall back to their first valid resolution.
- Upload PNGs are scaled to LINE limits; `stickers/` keeps native resolution.
- 40-sticker set = **2 sequential Gemini sheet calls**; sheet 2 also receives sheet 1 as a style anchor.
- **v3compact** prompts: `N|"phrase"|action` per cell (~25% shorter than v3).
- Grid validation **hard-rejects** wrong layout (e.g. 5×5 instead of 4×5) and uneven column widths.
- **Best attempt** is kept across at most 3 production attempts; re-slicing is preferred before spending another image call.
- Gemini **empty-image response** is retried up to 3 times before failing.
- Grid prompt includes `[0. GRID LAYOUT]` anchor to reduce 5×5 drift.
- Not included: LINE account setup, review, or pricing.
