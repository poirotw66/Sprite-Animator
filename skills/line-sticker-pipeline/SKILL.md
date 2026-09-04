---
name: line-sticker-pipeline
description: >-
  End-to-end LINE sticker pipeline from one reference image plus a designed
  phrase-set JSON (or job config). Validates inputs, dry-runs prompts,
  generates sprite sheets and sticker PNGs, optionally uploads to LINE Creators
  Market. Use when the user provides 圖片 + JSON, wants to 產生貼圖 / 做一套貼圖,
  or asks to run the sticker generation workflow headlessly. When sheets are
  already background-removed (已去背), slice with convert-sheet-v2 --already-keyed
  instead of re-running chroma.
---

# LINE Sticker Pipeline

Canonical skill sources live under `skills/`. `.agents/skills/` and
`.claude/skills/` are generated runtime mirrors; refresh both with
`npm run skills:sync:line-sticker` after edits.

The shared production preset is defined in `utils/lineStickerProductionPreset.ts`:
2K when supported, guided 4×5 layout with every character/style reference attached, automatic green/magenta selection with `core` chroma removal, blocking chroma/content QA, programmatic captions,
sheet-1 style anchoring, and at most 3 generation attempts per sheet.

**Shortcut — sheets already background-removed (已去背):** do **not** run Gemini
generation or chroma again. Slice with V2 and `--already-keyed`:

```bash
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --input path/to/sheets/ --output output/my-set --already-keyed --zip
```

See `line-sticker-maker` → ChatGPT / pre-keyed sheets, and
`docs/workflows/sheet-converter-v2.md`.

Thin agent entry point. Full workflow, commands, and checklists:

Read repo-root `docs/workflows/line-sticker-pipeline.md`.

Quick start (repo root):

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set path/to/phrases.json \
  --out output/my-set
```

Related: `line-sticker-phrase-design` (phrases) · `line-sticker-maker` (config) · `line-sticker-upload` (LINE Creators Market)
