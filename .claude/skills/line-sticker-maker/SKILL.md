---
name: line-sticker-maker
description: Generate a complete LINE sticker set from a single character reference image, fully headless (no browser). Produces sprite sheets via Gemini, slices stickers, and packages output for the line-s upload script (or legacy line-upload.zip). Use when the user wants to "make LINE stickers", "produce a sticker set", "生成貼圖 / 做一套貼圖" from a reference image.
---

# LINE Sticker Maker

Headless version of this project's LINE sticker workflow. Given one character
reference image, it generates sprite sheets with Gemini, removes the chroma-key
background, slices individual transparent sticker PNGs, and packages the result
for **line-s upload** (preferred) or legacy LINE Creators Market ZIP — all from
the command line, no browser/UI.

It **reuses the app's own modules** (`utils/lineStickerPrompt.ts`,
`utils/lineStickerSetSchema.ts`, `utils/chromaKeyCore.ts`,
`utils/lineStickerUploadSpec.ts`) so output matches the web app.

## How to run

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
4. **Run for real** → one command produces debug output + line-s upload folder.
5. **Spot-check** a few `stickers/sticker-NN.png` and `manifest.json` grid scores.
6. Tell the user the **`--out` folder** (upload ZIP + `.env.batch` live there). Copy
   to `line-s/input/706/` only when ready to upload.

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
| `includeText` | `true` | Gemini draws phrase text in each cell |
| `scope` | `set` | `set` = full LINE set; `single` = one sheet |
| `stickerCount` | `40` | 40 = 2×4×5 (LINE standard); 48 = legacy 3×4×4 |
| `model` | `gemini-3.1-flash-image` | use flash-image for stable 4×5 grids |
| `resolution` | `1K` | `0.5K`/`1K`/`2K`/`4K` (model-dependent) |
| `maxSheetRetries` | `3` | Gemini retries when grid validation fails |
| `minGridAlignmentScore` | `0.72` | 0–1; reject sheet below this score |
| `lineUpload` | `true` | build upload ZIP at end of full run |
| `mainStickerIndex` / `tabStickerIndex` | `1` | 1-based indices for shop images |
| **`lineS`** | — | **line-s upload layout (recommended)** |

### `lineS` block

| field | notes |
|---|---|
| `enabled` | default `true` when block is present |
| `root` | **optional** — external line-s repo. Omit to pack into `--out` (recommended). |
| `creatorId` | used in `.env.batch` paths (default `706`) |
| `setName` | English ZIP / MD base name, e.g. `Cozy Cream Cat Daily Chat` |
| `titleZh` / `descZh` | Traditional Chinese shop listing |
| `titleEn` / `descEn` | English shop listing |
| `writeEnvBatch` | default `true`; writes `<out>/.env.batch/{Set_Name}.env` |

When `lineS` is enabled (default), **`generate.mts` writes the upload pack into `--out`**:

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
    Cozy_Cream_Cat_Daily_Chat.env   ← copy to line-s repo when uploading
```

To publish: copy the set folder contents to `line-s/input/706/{Set Name}/`, or set
`lineS.root` to your line-s repo path for direct output there.

Without `lineS`, legacy output is `<out>/line-upload/` + `line-upload.zip`.

## Scripts

| script | purpose |
|---|---|
| `generate.mts` | full pipeline: Gemini → slice → finalize → line-s |
| `finalize.mts` | merge `activeSheets` → stickers + upload pack (after sheet regen) |
| `reslice-sheet.mts` | re-slice existing `_processed-sheet.png` (no Gemini) |
| `organize-line-s-input.mts` | standalone pack from legacy `line-upload.zip` (fallback) |
| `rebuild-line-upload.mts` | legacy only; prefer `finalize.mts` |

## manifest.json

After a full run or `finalize.mts`:

```json
{
  "activeSheets": ["sheet-1", "sheet-2"],
  "gridScores": { "sheet-1": 0.85, "sheet-2": 0.84 },
  "lineSDest": ".../example/output/p4",
  "stickers": [ ... ]
}
```

## Notes / limits

- Sprite sheets: **1:1 @ 1K → 1024×1024 px** (4×5 → ~256×204 px per cell).
- Upload PNGs are scaled to LINE limits; `stickers/` keeps native resolution.
- 40-sticker set = **2 Gemini calls** (one per sheet).
- Grid prompt includes `[0. GRID LAYOUT]` anchor to reduce 5×5 drift.
- Not included: LINE account setup, review, or pricing.
