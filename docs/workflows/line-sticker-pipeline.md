# LINE Sticker Pipeline

Orchestrates the full **image + JSON → stickers** workflow in this repo.
Headless only (no browser). Reuses app modules and scripts under `scripts/line-sticker/`.

## Canonical paths and production defaults

- `.claude/skills/` is the tracked source of truth for LINE sticker skills.
- `.agents/skills/` is a generated Codex runtime mirror. Run
  `npm run skills:sync:line-sticker` after changing a canonical skill.
- `utils/lineStickerProductionPreset.ts` is the single source for headless defaults:
  2K when supported, guided layout, `core` chroma removal, programmatic text with
  canvas composition, sheet-1 style anchoring, grid score 0.8, and 3 total attempts.
- A field explicitly provided in `job.config.json` overrides the production preset.

The canonical full-config examples are:

- `.claude/skills/line-sticker-maker/config.example.json`
- `.claude/skills/line-sticker-maker/examples/demo-job.config.json`

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

**Daily mass production (30 sets):** see [line-sticker-daily-factory.md](./line-sticker-daily-factory.md)
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
npx tsx scripts/line-sticker/run-from-inputs.mts \
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

`run-from-inputs.mts` writes `<out>/job.config.json` + copies phrase-set, then calls `generate.mts`.

## Agent workflow

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

### Step 3 — Dry-run

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts \
  --image <image> \
  --phrase-set <phrases.json> \
  --out <out> \
  --dry-run
```

### Step 4 — Generate

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts \
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
  manifest.json
  qa-report.json
  {Set Name}.zip
  .env.batch/{Set_Name}.env
```

### Step 5b — Re-slice after chroma fixes (no Gemini)

```bash
npx tsx scripts/line-sticker/reslice-sheet.mts output/<set>/sheet-1 4 5 template
npx tsx scripts/line-sticker/reoverlay-sheet.mts output/<set>/sheet-1 4 5 \
  --phrases output/<set>/phrase-set.json --offset 0
npx tsx scripts/line-sticker/reslice-sheet.mts output/<set>/sheet-2 4 5 template
npx tsx scripts/line-sticker/reoverlay-sheet.mts output/<set>/sheet-2 4 5 \
  --phrases output/<set>/phrase-set.json --offset 20
npx tsx scripts/line-sticker/finalize.mts \
  --out output/<set> --config output/<set>/job.config.json
```

### Step 6 — Upload (optional)

See **`.claude/skills/line-sticker-upload/SKILL.md`**.

```bash
npx tsx scripts/line-sticker/run-line-upload.mts \
  --env <out>/.env.batch/Set_Name.env
```

## Related skills

| skill | when |
|---|---|
| `line-sticker-daily-factory` | daily 30-set batch |
| `line-sticker-character-ref` | generate character model-sheet reference image |
| `line-sticker-phrase-design` | design phrase-set JSON before generation |
| `line-sticker-maker` | low-level script reference, config fields, manifest |
| `line-sticker-upload` | Drive + Playwright LINE Creators Market upload |

Details: `.claude/skills/line-sticker-maker/SKILL.md`
