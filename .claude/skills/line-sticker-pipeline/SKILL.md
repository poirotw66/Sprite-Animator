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
