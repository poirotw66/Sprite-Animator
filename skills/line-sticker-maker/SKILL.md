---
name: line-sticker-maker
description: >-
  Handles advanced headless LINE sticker operations: explicit job configs,
  regenerating or finalizing selected sheets, reslicing after chroma fixes, and
  converting existing ChatGPT/pre-keyed sprite sheets. Use for recovery or
  low-level control. Use line-sticker-pipeline for an ordinary reference image +
  phrase-set run, and line-sticker-upload for external delivery.
---

# LINE Sticker Maker

Advanced and recovery entry point for the repository's sticker scripts. Run from
the repo root.

## Route the request

| Request | Use |
|---|---|
| Reference image + phrase JSON → complete set | `line-sticker-pipeline` |
| Explicit job config or one-sheet regeneration | this skill |
| Existing sheet needs keying/slicing | this skill, V2 converter |
| Existing transparent sheet / 已去背 | this skill with `--already-keyed` |
| Publish a completed package | `line-sticker-upload` |

## Existing or pre-keyed sheets

Never re-key an image the user identifies as 已去背 / already keyed. Alpha PNGs
and files such as `_v2_keyed_sheet.png` or `_processed-sheet.png` also use
`--already-keyed`.

```bash
# One opaque paper/chroma sheet: key once, then slice
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --sheet path/to/sheet.png --out output/my-set

# One transparent sheet: slice only
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --sheet path/to/sheet.png --out output/my-set --already-keyed

# Folder of transparent sheets + ZIP
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --input path/to/sheets --output output/my-set --already-keyed --zip
```

Read repo-root `docs/workflows/sheet-converter-v2.md` for converter behavior.

## Full-control generation

```bash
# Inspect prompts without an API call
npx tsx scripts/line-sticker/generate.mts \
  --config skills/line-sticker-maker/examples/demo-job.config.json \
  --out output/my-set --dry-run

# Generate only after the user authorizes the paid API operation
npx tsx scripts/line-sticker/generate.mts \
  --config path/to/job.config.json --out output/my-set
```

Regenerate one sheet into an isolated directory, then finalize the selected set:

```bash
npx tsx scripts/line-sticker/generate.mts --config job.json --out output/my-set \
  --sheet sheet-1 --sheet-dir sheet-1-v2
npx tsx scripts/line-sticker/finalize.mts --out output/my-set --config job.json \
  --sheets sheet-1-v2,sheet-2
```

For reslicing and config/manifest details, read
[job config and recovery](references/job-config-and-recovery.md).

## Required checks

1. Preserve the recorded resolved chroma unless the user requests an override.
2. Prefer reslicing before spending another image-generation call.
3. Confirm `manifest.json` completion status, grid scores, and `qaReport.pass`.
4. Report the output path and any warnings or failed stage.
5. Do not upload or submit for review unless separately and explicitly requested.

API key: `GEMINI_API_KEY` in the environment or repo `.env` / `.env.local`.
