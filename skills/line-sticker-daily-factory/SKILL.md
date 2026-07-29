---
name: line-sticker-daily-factory
description: >-
  Daily factory for 30 LINE sticker sets (2:1 B new characters / A theme rotation).
  Orchestrates backfill, planning, character-ref, phrase-design, and pipeline via
  daily-pack.mts and sticker-registry.json. Use when the user wants 日產 30 套、
  自動化工廠、daily-pack、量產貼圖.
---

# LINE Sticker Daily Factory

Resume/backfill considers a set completed only after the shared validator confirms all expected stickers, processed sheets, passing grid/chroma QA, and an upload ZIP.

Thin agent entry point. Full architecture, flags, and agent checklist:

**[docs/workflows/line-sticker-daily-factory.md](../../../docs/workflows/line-sticker-daily-factory.md)**

Quick start:

```bash
npx tsx scripts/line-sticker/daily-pack.mts --backfill --plan-only
npx tsx scripts/line-sticker/daily-pack.mts --execute --resume
```
