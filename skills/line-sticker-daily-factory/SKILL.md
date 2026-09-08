---
name: line-sticker-daily-factory
description: >-
  Plans or executes daily bulk LINE sticker production (default 30 sets, 2:1 new
  characters to theme rotations) through daily-pack.mts and the registry. Use for
  日產 30 套、自動化工廠、daily-pack、量產貼圖; do not use for one ordinary set.
---

# LINE Sticker Daily Factory

Resume/backfill considers a set completed only after the shared validator confirms all expected stickers, processed sheets, passing grid/chroma QA, and an upload ZIP.

Planning is the safe default. `--execute` makes many paid Gemini calls, so run it
only when the user explicitly authorizes execution for a concrete date/count.
Never infer upload permission from batch-generation permission.

Thin agent entry point. Full architecture, flags, and agent checklist:

Read repo-root `docs/workflows/line-sticker-daily-factory.md`.

Quick start:

```bash
npx tsx scripts/line-sticker/daily-pack.mts --backfill --plan-only
# Only after the plan and execution scope are approved:
npx tsx scripts/line-sticker/daily-pack.mts --execute --resume
```
