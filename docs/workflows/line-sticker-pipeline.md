# LINE Sticker Pipeline

Orchestrates the full **image + JSON → stickers** workflow in this repo.
Headless only (no browser). Reuses app modules and scripts under `scripts/line-sticker/`.

## Canonical paths and production defaults

- `skills/` is the tracked source of truth for LINE sticker skills.
- `.agents/skills/` and `.claude/skills/` are generated runtime mirrors. Run
  `npm run skills:sync:line-sticker` after changing a canonical skill.
- `utils/lineStickerProductionPreset.ts` is the single source for headless defaults:
  2K when supported, guided layout, automatic green/magenta selection with `core` chroma removal, blocking automated frame/chroma QA, programmatic text with
  canvas composition, sheet-1 style anchoring, grid score 0.8, and 3 total attempts.
- A field explicitly provided in `job.config.json` overrides the production preset.

The canonical full-config examples are:

- `skills/line-sticker-maker/config.example.json`
- `skills/line-sticker-maker/examples/demo-job.config.json`

## Headless CLI contract

All public LINE sticker entry points accept `--help`.  Their relative input and
output paths are resolved from the repository root, so commands behave the same
when invoked from a subdirectory or CI. Invalid or incomplete CLI arguments
print `Usage:` and exit with code `2`; pipeline, filesystem, and API failures
exit with code `1`.

## Inputs

| Input | Required | Notes |
|---|---|---|
| **Reference image** | yes | `png` / `jpg` / `webp` — character style reference |
| **Phrase-set JSON** | yes* | Designed via **`line-sticker-phrase-design`** skill, or hand-written |
| **Output folder** | yes | e.g. `output/my-cat-set` |
| **Job config JSON** | alt | Full `job.config.json` instead of image + phrase-set |

Design phrase-set first: **`skills/line-sticker-phrase-design/SKILL.md`**

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

Use the complete [40-sticker phrase-set example](../../skills/line-sticker-phrase-design/example/daily-set-40.json)
as an importable starting point. `mode: "set"` requires exactly 40 phrases and,
when provided, 40 matching action descriptions. A two-item excerpt is not a valid
set input. The 20-item conversational plans used by the Huahua/sprite-sheet
skills have their own handoff rules; combine them before using this importer.

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
| `--dry-run` | preview prompts without Gemini calls; image + JSON mode still creates the output directory, copies its inputs, and writes `job.config.json` |
| `--set-name` | English ZIP / upload folder name (default: derived from Chinese title) |
| `--title-zh` / `--desc-zh` | LINE 商店標題與說明（預設取自 phrase-set `name`） |
| `--title-en` / `--desc-en` | English shop listing |
| `--job path/to/job.config.json` | skip auto-config; use existing job file |
| `--upload` | immediately run LINE upload after generation (needs Python/Playwright); the agent workflow omits this flag to review content before a separate authorized upload |

In image + JSON mode, `run-from-inputs.mts` writes `<out>/job.config.json`, copies
`phrase-set.json` and `reference-image.<ext>` (plus `reference-image-2.<ext>` when
provided), then calls `generate.mts`. These local writes also happen during
`--dry-run`; it does not create generated sheets, stickers, or upload artifacts.
With `--job`, the entry point creates the output directory and reads the supplied
config and its inputs without making those copies or writing a new config.

## Agent workflow

```
Pipeline:
- [ ] 1. Confirm image path + phrase-set JSON (or job config)
- [ ] 2. Ensure GEMINI_API_KEY (repo `.env` / `.env.local` / env var)
- [ ] 2b. (Upload) Fill `.secrets/line-sticker/credentials.env` once (`LINE_*` required; Google Drive OAuth JSON optional — without it, provision 夾帶 sprite-sheet ZIP)
- [ ] 3. Dry-run: run-from-inputs.mts --dry-run
- [ ] 4. Generate for real without --upload; keep content review before external upload
- [ ] 5. Check stickers/ + manifest.json gridScores for structural results
- [ ] 6. Confirm packaging status: `manifest.json` has `completionStatus: "completed"` and `qaReport.pass: true`; `qaMode: "report"` may intentionally produce `completed_with_warnings`. This does not establish content approval.
- [ ] 6b. Review every final sticker at delivery size: record independent text, character, action, and cropping checks in content-review.json. Missing evidence is unverified; unresolved defects stay pending acceptance.
- [ ] 7. Confirm requested/resolved chroma are recorded; reslice/finalize must use the resolved value

Finalize uses `.finalize-staging/<run-id>` and publishes stickers, QA, and upload
artifacts before committing the completed manifest. Packaging/sync exceptions are
recorded as `packaging_failed` with the failed stage and error; abandoned staging is
removed on the next finalize run. `grid_failed`, `qa_failed`, `packaging_failed`,
and `finalizing` outputs are never resumable as completed sets. Explicit report-mode
outputs use `completed_with_warnings`.

Each generated sheet verifies its actual border chroma before removal. A reliable
green/magenta mismatch is retried within the existing generation budget, and accepted
sheets persist `chroma-detection.json` plus `manifest.json.sheetChromaDetections`.
Upload-root publication uses sibling staging directories, and completed validation
checks ZIP CRC/name safety and decoded PNG transparency rather than only PNG headers.

Chroma QA thresholds scale with the actual sticker: enclosed chroma pockets use the
foreground-pixel population, and despill fringe uses the Alpha-edge population.
Small stickers retain absolute minimum thresholds, while `qa-report.json` records
the ratios and resolved pixel thresholds used for every sticker.
- [ ] 8. (Optional) Upload via line-sticker-upload skill, only when explicitly requested
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
  content-review.json              # agent-authored review of final sticker content
  {Set Name}.zip
  .env.batch/{Set_Name}.env
```

Follow [content review](../../skills/line-sticker-maker/references/content-review.md)
for the review record, evidence, and exception handling. Cover the actual configured
output count, including single-sheet jobs. Keep structural/packaging completion
separate from content results; a passed alpha/grid/chroma check cannot establish
correct text, identity, or action. Report a review candidate when content remains
failed or unverified, rather than declaring it approved for upload.

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

`reslice-sheet.mts` reuses the resolved chroma color and algorithm stored in the
manifest. Use `--chroma green|magenta` only when an explicit override is needed.
After reslicing, caption changes, regeneration, or finalization changes the final
images, repeat the content checks for every affected sticker and update the review
record against those files. Existing approval does not transfer to changed images.

### Step 6 — Upload (optional)

See **`skills/line-sticker-upload/SKILL.md`**.
After content review, invoke upload separately for the explicitly authorized
package. A combined generate-and-upload request already supplies upload
authorization; continue within that scope without requesting it again. Review
submission remains a separately authorized step.

```bash
npx tsx scripts/line-sticker/run-line-upload.mts \
  --env <out>/.env.batch/Set_Name.env --submit false
```

## Related skills

| skill | when |
|---|---|
| `line-sticker-daily-factory` | daily 30-set batch |
| `line-sticker-character-ref` | generate character model-sheet reference image |
| `line-sticker-phrase-design` | design phrase-set JSON before generation |
| `line-sticker-maker` | low-level script reference, config fields, manifest |
| `line-sticker-upload` | Drive + Playwright LINE Creators Market upload |

Details: `skills/line-sticker-maker/SKILL.md`
