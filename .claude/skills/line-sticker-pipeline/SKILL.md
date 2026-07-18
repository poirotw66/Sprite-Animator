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

Canonical skill sources live under `.claude/skills`. `.agents/skills` is a generated
Codex runtime mirror; refresh it with `npm run skills:sync:line-sticker` after edits.

The shared production preset is defined in `utils/lineStickerProductionPreset.ts`:
2K when supported, guided 4×5 layout, `core` chroma removal, programmatic captions,
sheet-1 style anchoring, and at most 3 generation attempts per sheet.

Thin agent entry point. Full workflow, commands, and checklists:

**[docs/workflows/line-sticker-pipeline.md](../../../docs/workflows/line-sticker-pipeline.md)**

Quick start (repo root):

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set path/to/phrases.json \
  --out output/my-set
```

Related: `line-sticker-phrase-design` (phrases) · `line-sticker-maker` (config) · `line-sticker-upload` (LINE Creators Market)
