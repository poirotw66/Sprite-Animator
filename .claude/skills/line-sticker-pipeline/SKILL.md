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
- [ ] 2. Ensure GEMINI_API_KEY (.env / .env.local / env var)
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

### Step 6 — Upload (optional)

See **`.claude/skills/line-sticker-upload/SKILL.md`**.

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
| Re-slice (no Gemini) | `reslice-sheet.mts` |

Details: `.claude/skills/line-sticker-maker/SKILL.md`

## Related skills

| skill | when |
|---|---|
| `line-sticker-character-ref` | generate character model-sheet reference image |
| `line-sticker-phrase-design` | design phrase-set JSON before generation |
| `line-sticker-maker` | low-level script reference, config fields, manifest |
| `line-sticker-upload` | Drive + Playwright LINE Creators Market upload |

## Limits

- Set mode: 40 stickers = 2× 4×5 sheets (parallel by default).
- Default: `textRendering: model` (Gemini draws captions); `programmatic` optional for stable zh-TW overlay.
- Default image model: `gemini-3.1-flash-image` (not flash-lite — better 4×5 grid alignment).
- Upload needs the repo-local upload skill deps from `.claude/skills/line-sticker-upload/`.
