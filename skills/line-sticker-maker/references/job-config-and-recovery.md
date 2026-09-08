# Job config and recovery

Use this reference only for explicit job configuration, failed-run recovery, or
manual reslicing/finalization. The normal image + phrase-set path belongs to the
`line-sticker-pipeline` skill.

## Production defaults and overrides

`utils/lineStickerProductionPreset.ts` is the default source. Fields explicitly
present in a job config override it. Start from
`skills/line-sticker-maker/config.example.json` or
`skills/line-sticker-maker/examples/demo-job.config.json`.

Important fields:

| Field | Default | Purpose |
|---|---|---|
| `referenceImage` | required | Character PNG/JPG/WebP |
| `phraseSetFile` | recommended | Designed phrase/action JSON |
| `style` | `matchUploaded` | Style preset or uploaded identity |
| `chromaKeyColor` | `auto` | Select safer green/magenta key |
| `chromaKeyAlgorithm` | `core` | `legacy` and `forge` are compatibility modes |
| `textRendering` | `programmatic` | Deterministic caption overlay |
| `stickerCount` | `40` | Two 4×5 sheets |
| `model` | production preset | Gemini image model |
| `resolution` | `2K` | Model-dependent |
| `maxSheetRetries` | `3` | Total attempts per sheet |
| `minGridAlignmentScore` | `0.8` | Reject worse layouts |
| `styleAnchorFromPriorSheet` | `true` | Stabilize later sheets |
| `qaEnabled` / `qaMode` | `true` / `block` | Block failed packages |
| `upload` | optional | Local upload-pack metadata, not permission to publish |

`requestedChromaKeyColor` and `resolvedChromaKeyColor` are persisted separately.
Generation, reslicing, finalization, and QA must reuse the resolved value.

## Reslice without Gemini

```bash
npx tsx scripts/line-sticker/reslice-sheet.mts <out>/sheet-1 4 5 template
npx tsx scripts/line-sticker/reoverlay-sheet.mts <out>/sheet-1 4 5 \
  --phrases <out>/phrase-set.json --offset 0
npx tsx scripts/line-sticker/reslice-sheet.mts <out>/sheet-2 4 5 template
npx tsx scripts/line-sticker/reoverlay-sheet.mts <out>/sheet-2 4 5 \
  --phrases <out>/phrase-set.json --offset 20
npx tsx scripts/line-sticker/finalize.mts \
  --out <out> --config <out>/job.config.json
```

Use `--chroma green|magenta` only for an intentional override.

## Completion evidence

A successful full run includes `stickers/`, `manifest.json`, `qa-report.json`, and
the LINE ZIP. `completionStatus: "completed"` requires passing blocking QA;
`completed_with_warnings` is valid only for an explicitly selected report mode.
`grid_failed`, `qa_failed`, `packaging_failed`, and `finalizing` are incomplete.

Finalize stages artifacts before publishing them. A packaging exception records
`finalizeStage` and `finalizeError`; rerunning finalize cleans abandoned staging.
Completed validation checks ZIP paths/CRC, decoded PNG transparency and dimensions,
manifest mapping, active processed sheets, grid QA, and chroma QA.

For the complete normal workflow, read repo-root
`docs/workflows/line-sticker-pipeline.md`.
