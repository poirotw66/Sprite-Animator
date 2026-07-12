---
name: line-sticker-pipeline
description: >-
  End-to-end LINE sticker pipeline from one reference image plus a designed
  phrase-set JSON (or job config). Validates inputs, dry-runs prompts,
  generates sprite sheets and sticker PNGs, optionally uploads to LINE Creators
  Market. Use when the user provides 圖片 + JSON, wants to 產生貼圖 / 做一套貼圖,
  or asks to run the sticker generation workflow headlessly.
---

# LINE Sticker Pipeline

Orchestrates the full **image + JSON → stickers** workflow in this repo.
Headless only (no browser). Reuses app modules and the scripts under
`.claude/skills/line-sticker-maker/`.

## Inputs

| Input | Required | Notes |
|---|---|---|
| **Reference image** | yes | `png` / `jpg` / `webp` — character style reference |
| **Phrase-set JSON** | yes* | Designed via **`line-sticker-phrase-design`** skill, or hand-written |
| **Output folder** | yes | e.g. `output/my-cat-set` |
| **Job config JSON** | alt | Full `job.config.json` instead of image + phrase-set |

Design phrase-set first: **`.claude/skills/line-sticker-phrase-design/SKILL.md`**

\* Or pass `--job` with an existing config that already points at both files.

## Full flow (design → generate)

```
0. line-sticker-character-ref  →  character-ref.png (optional)
1. line-sticker-phrase-design  →  phrases.json
2. line-sticker-pipeline       →  image + phrases.json → stickers/
3. line-sticker-upload         →  (optional) LINE Creators Market
```

**Daily mass production (30 sets):** see **`.claude/skills/line-sticker-daily-factory/SKILL.md`**
(`daily-pack.mts` + `output/sticker-registry.json`).

```json
{
  "format": "line-sticker-phrase-set",
  "version": 1,
  "mode": "set",
  "phrases": ["早安", "晚安"],
  "actionDescs": ["wave hand", "sleepy expression"],
  "name": "奶油貓日常"
}
```

## One-command entry

From repo root:

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set path/to/phrases.json \
  --out output/my-set
```

Options:

| flag | purpose |
|---|---|
| `--dry-run` | print prompts only (no Gemini, no files beyond `job.config.json`) |
| `--set-name` | English ZIP / upload folder name (default: derived from Chinese title) |
| `--title-zh` / `--desc-zh` | LINE 商店標題與說明（預設取自 phrase-set `name`） |
| `--title-en` / `--desc-en` | English shop listing |
| `--job path/to/job.config.json` | skip auto-config; use existing job file |
| `--upload` | after generate, run LINE upload (needs local Python/Playwright setup) |

`run-from-inputs.mts` writes `<out>/job.config.json` + copies phrase-set, then
calls `generate.mts`.

## Agent workflow

Copy this checklist and track progress:

```
Pipeline:
- [ ] 1. Confirm image path + phrase-set JSON (or job config)
- [ ] 2. Ensure GEMINI_API_KEY (repo `.env` / `.env.local` / env var)
- [ ] 2b. (Upload) Fill `line-sticker-maker/credentials.env` once
- [ ] 3. Dry-run: run-from-inputs.mts --dry-run
- [ ] 4. Generate for real
- [ ] 5. Spot-check stickers/ + manifest.json gridScores
- [ ] 6. (Optional) Upload via line-sticker-upload skill
```

### Step 1 — Gather inputs

Ask only for what's missing:

- reference image path
- phrase-set JSON path (or pasted JSON → save to a file)
- output folder name
- shop titles (zh/en) if uploading later

### Step 2 — API key

```bash
# one of:
export GEMINI_API_KEY=...
# or repo .env / .env.local
```

### Step 3 — Dry-run

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image <image> \
  --phrase-set <phrases.json> \
  --out <out> \
  --dry-run
```

Verify prompt text and phrase count per sheet.

### Step 4 — Generate

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image <image> \
  --phrase-set <phrases.json> \
  --out <out> \
  --set-name "Cream Cat Daily Chat" \
  --title-zh "奶油貓日常" \
  --title-en "Cream Cat Daily"
```

### Step 5 — Verify output

```
<out>/
  job.config.json
  phrase-set.json
  sheet-1/ … sheet-N/
  stickers/sticker-01.png …
  manifest.json          ← gridScores, activeSheets
  qa-report.json         ← if qaEnabled (default)
  {Set Name}.zip         ← LINE upload pack (set mode)
  .env.batch/{Set_Name}.env
```

Spot-check 2–3 stickers and `manifest.json` → `gridScores` (target ≥ 0.8).

**Chroma spot-check (required for zh-TW sets):**

| check | what to look for |
|---|---|
| Enclosed pockets | green between arms / hair gaps (`pocketGreenCount` in `qa-report.json`) |
| Outer edge | `edgeGreenCount` is recorded for debugging only — not used for QA warnings |
| Black lines | speed lines / ink must stay — **never erase neutral gray `(R≈G≈B)`** |
| Floaters | tiny crumbs disconnected from subject |

`qa-report.json` entries include `edgeGreenCount`, `pocketGreenCount`, `oliveFringeCount`.
**Actionable** summary warnings: pocket green ≥ 8, olive fringe ≥ 12. `edgeGreenCount` is informational.

### Step 5b — Re-slice after chroma fixes (no Gemini)

When tuning `chromaKeyCore` or fixing green pockets **without** regenerating art:

```bash
# sheet-1 = stickers 01–20, sheet-2 = stickers 21–40 (offset 20)
npx tsx .claude/skills/line-sticker-maker/scripts/reslice-sheet.mts \
  output/<set>/sheet-1 4 5 template

npx tsx .claude/skills/line-sticker-maker/scripts/reoverlay-sheet.mts \
  output/<set>/sheet-1 4 5 \
  --phrases output/<set>/phrase-set.json --offset 0

npx tsx .claude/skills/line-sticker-maker/scripts/reslice-sheet.mts \
  output/<set>/sheet-2 4 5 template

npx tsx .claude/skills/line-sticker-maker/scripts/reoverlay-sheet.mts \
  output/<set>/sheet-2 4 5 \
  --phrases output/<set>/phrase-set.json --offset 20

npx tsx .claude/skills/line-sticker-maker/scripts/finalize.mts \
  --out output/<set> --config output/<set>/job.config.json
```

Requires `_raw-sheet.jpg` in each sheet folder. Use `template` slice mode when
`_grid-template-guided.png` exists (default for guided grid jobs).

**Chroma safety rule (do not regress):** pocket cleanup only clears pixels where
`G > max(R,B)` and chroma distance is below threshold. **Never** alpha-erase
neutral gray / black line AA (`max(R,G,B) - min(R,G,B) < 12`) — those are
original ink, not green-screen residue.

### Step 6 — Upload (optional)

1. Copy and fill **`.claude/skills/line-sticker-maker/credentials.env`** (see `credentials.env.example`).
2. Run upload — credentials are merged into `<out>/.env.batch/*.env` automatically.

Couple / dual-character sets: pass `--image2 path/to/second-ref.png` on `run-from-inputs.mts`.

See **`.claude/skills/line-sticker-upload/SKILL.md`** for Drive / Playwright setup.

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image <image> --phrase-set <phrases.json> --out <out> --upload
```

Or upload only:

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts \
  --env <out>/.env.batch/Set_Name.env
```

## Regenerate / fix sheets

| task | command |
|---|---|
| One sheet only | `generate.mts --config <out>/job.config.json --out <out> --sheet sheet-1 --sheet-dir sheet-1-v2` |
| Merge + repack | `finalize.mts --out <out> --config <out>/job.config.json --sheets sheet-1-v2,sheet-2` |
| Re-slice (no Gemini) | `reslice-sheet.mts` → `reoverlay-sheet.mts` → `finalize.mts` (see below) |

### Re-slice workflow (chroma fix, no Gemini)

```bash
# sheet-1 (stickers 01–20)
npx tsx .claude/skills/line-sticker-maker/scripts/reslice-sheet.mts <out>/sheet-1 4 5 template
npx tsx .claude/skills/line-sticker-maker/scripts/reoverlay-sheet.mts <out>/sheet-1 4 5 \
  --phrases <out>/phrase-set.json --offset 0

# sheet-2 (stickers 21–40)
npx tsx .claude/skills/line-sticker-maker/scripts/reslice-sheet.mts <out>/sheet-2 4 5 template
npx tsx .claude/skills/line-sticker-maker/scripts/reoverlay-sheet.mts <out>/sheet-2 4 5 \
  --phrases <out>/phrase-set.json --offset 20

npx tsx .claude/skills/line-sticker-maker/scripts/finalize.mts \
  --out <out> --config <out>/job.config.json
```

`reslice-sheet.mts` reads `_raw-sheet.jpg`, re-runs chroma key + slice.
`reoverlay-sheet.mts` re-applies programmatic captions when `textRendering: programmatic`.
Both sheets must be resliced before `finalize.mts`.

### Chroma key rules (guided green)

| residue type | action |
|---|---|
| Enclosed green pocket (armpit / hair gap) | `clearGuidedGreenPockets` — Pass 5 in `chromaKeyCore` |
| Green edge fringe | despill + strong spill erase (`G > R` and `G > B`) |
| Neutral gray / black line AA | **never erase** — original ink / speed lines |
| Interior green prop (`greenExcess >= 45`) | keep |
| Lone neon green accent (0–1 green neighbors) | keep |

**Never** use neutral-gray protrusion erase — it deletes black line art.

Details: `.claude/skills/line-sticker-maker/SKILL.md`

## Related skills

| skill | when |
|---|---|
| `line-sticker-daily-factory` | daily 30-set batch (`daily-pack.mts` + registry) |
| `line-sticker-character-ref` | generate character model-sheet reference image |
| `line-sticker-phrase-design` | design phrase-set JSON before generation |
| `line-sticker-maker` | low-level script reference, config fields, manifest |
| `line-sticker-upload` | Drive + Playwright LINE Creators Market upload |

## Limits

- Set mode: 40 stickers = 2× 4×5 sheets (parallel by default).
- Default: `textRendering: model` (Gemini draws captions); `programmatic` optional for stable zh-TW overlay.
- Default image model: `gemini-3.1-flash-image` (2K). Chroma key: `legacy` (`DEFAULT_CHROMA_KEY_ALGORITHM`).
- Upload needs the repo-local upload skill deps from `.claude/skills/line-sticker-upload/`.
