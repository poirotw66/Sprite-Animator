# Scripts moved

Headless LINE sticker scripts now live at **`scripts/line-sticker/`** (repo root).

Examples:

```bash
npx tsx scripts/line-sticker/run-from-inputs.mts --image ref.png --phrase-set phrases.json --out output/my-set
npx tsx scripts/line-sticker/generate.mts --config job.config.json --out output/my-set
npx tsx scripts/line-sticker/daily-pack.mts --backfill --plan-only
```

See `.claude/skills/line-sticker-maker/SKILL.md` and `docs/workflows/`.
