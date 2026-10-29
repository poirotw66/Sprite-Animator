---
name: line-sticker-pipeline
description: >-
  Runs the normal headless LINE sticker workflow from a character reference plus
  phrase-set JSON (or an existing job config): validate, dry-run, generate, slice,
  QA, and package. Use for 圖片 + JSON、產生貼圖、做一套貼圖. Use
  line-sticker-maker instead for regeneration, recovery, or existing sprite
  sheets; use line-sticker-upload only when upload or review submission is
  explicitly requested.
---

# LINE Sticker Pipeline

Canonical skill sources live under `skills/`. `.agents/skills/` and
`.claude/skills/` are generated runtime mirrors; refresh both with
`npm run skills:sync:line-sticker` after edits.

The shared production preset is defined in `utils/lineStickerProductionPreset.ts`.
Explicit job fields may override it.

## Operating rules

- Confirm the reference image, phrase-set/job config, and output directory.
- If only a character concept exists, route to `line-sticker-character-ref` first.
  If the phrase content or tone is missing, route to `line-sticker-phrase-design`.
  Pipeline validation covers file/schema readiness, not creative phrase repair.
- Run a dry-run before paid image generation unless the user explicitly asks to
  resume an already-reviewed job.
- Actual Gemini generation must be requested by the user. A request to inspect,
  plan, or validate is not permission to generate.
- Generate new or changed images without `--upload`: that flag invokes upload
  immediately after generation, before agent content review. For a combined
  generate-and-upload request, finish generation and content review, then invoke
  `line-sticker-upload` separately for the authorized package. Existing upload
  authorization remains valid; do not ask for it again. Upload and review
  submission are separate permissions.
- After finalization, review every final sticker's text, character, action, and
  cropping using [content review](../line-sticker-maker/references/content-review.md).
  Packaging completion and `qaReport.pass` are structural evidence, not content
  approval. Report unverified checks and pending defects separately; accepted
  exceptions retain their failed checks.

**Shortcut — sheets already background-removed (已去背):** do **not** run Gemini
generation or chroma again. Slice with V2 and `--already-keyed`:

```bash
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --input path/to/sheets/ --output output/my-set --already-keyed --zip
```

See `line-sticker-maker` and `docs/workflows/sheet-converter-v2.md` for existing
or pre-keyed sheets.

For a requested transparent 4×5 / 37:40 sheet, read
`skills/line-sticker-sprite-sheet/SKILL.md`. Generate → review slices → repack the
final 2960×3200 canvas deterministically. Fix recoverable geometry by repacking,
and reserve corrective image calls for content. Record text, character, action
and cropping separately; unresolved content defects stay pending acceptance.
This branch does not change the existing Gemini chroma workflow.

Thin agent entry point. Full workflow, commands, and checklists:

Read repo-root `docs/workflows/line-sticker-pipeline.md`.

Quick start (repo root):

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set path/to/phrases.json \
  --out output/my-set
```

Related: `line-sticker-phrase-design` (phrases) · `line-sticker-maker`
(advanced/recovery) · `line-sticker-upload` (explicit external delivery)
