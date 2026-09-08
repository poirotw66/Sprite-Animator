---
name: line-sticker-upload
description: >-
  Stages a completed sticker package in Google Drive and operates LINE Creators
  Market through Playwright. Use only when the user explicitly asks to stage,
  upload, provision, or submit a specific package; generating or packaging a set
  alone is not permission to publish it.
---

# LINE Sticker Upload

Google Drive and Playwright scripts live at:
`skills/line-sticker-upload/scripts/`

## Authorization boundary

- Input inspection and local preflight are read-only.
- Drive staging, Creators Market form creation, and ZIP upload mutate external
  systems. Confirm the exact package and requested step before running them.
- Review submission is a separate, highest-impact step. Never infer `submit` from
  “upload”, and never enable automatic submission without explicit authorization.
- Batch upload requires an explicitly named directory/range; do not infer it from
  a request concerning one set.

## Environment files

Three files, three roles — do not mix secrets into the batch env by hand.

| File | Contains | Created by |
|------|----------|------------|
| `.secrets/line-sticker/credentials.env` | `LINE_EMAIL`, `LINE_PASSWORD`, `LINE_CREATOR_ID`, `GOOGLE_*`, `GDRIVE_PARENT_FOLDER` | You (once) — `credentials.env.example` |
| `<out>/.env.batch/{Set_Name}.env` | Shop titles, ZIP/sprite paths, runtime `LINE_STICKER_ID`, `GDRIVE_FOLDER_ID`, `GDRIVE_SHARE_URL` | `generate` / `finalize` / `sync-upload-input` |
| `.secrets/line-sticker/upload.env` | **Legacy** — all-in-one file for manual Python runs | Optional fallback if `credentials.env` missing |

**Normal flow:** fill `credentials.env` → run `run-line-upload.mts --env <batch>`.
The wrapper merges credentials into the batch file automatically.

`LINE_CREATOR_ID` is your Creators Market account ID from the URL:
`https://creator.line.me/my/{LINE_CREATOR_ID}/...`

`LINE_STICKER_ID` is written by `provision_line_sticker.py` into the batch env (not `credentials.env`).

OAuth / session artifacts (never commit):

- `.secrets/line-sticker/gdrive_credentials.json` — Google Desktop OAuth client
- `.secrets/line-sticker/gdrive_token.json` — Drive API token (auto-refreshed)
- `.line-upload/state/playwright_line_state.json` — LINE login session (auto-created)

## Setup (once)

```bash
uv sync --locked --dev
uv run playwright install chromium

cp skills/line-sticker-maker/credentials.env.example \
   .secrets/line-sticker/credentials.env
# fill LINE_EMAIL, LINE_PASSWORD, LINE_CREATOR_ID, GOOGLE_*
```

Place `gdrive_credentials.json` at
`.secrets/line-sticker/gdrive_credentials.json` (Google Cloud Console → Desktop OAuth).

## Workflow with line-sticker-maker

```text
line-sticker-maker (generate.mts)
  → <out>/                         ← local pack (zip, md, sprite_sheets)
  → sync-upload-input (auto by default)
  → .line-upload/input/706/{Set Name}/
  → <out>/.env.batch/{Set_Name}.env
  → run-line-upload.mts            ← merges credentials.env → batch → Python steps
```

### 1. Generate stickers

```bash
npx tsx scripts/line-sticker/generate.mts \
  --config skills/line-sticker-maker/examples/demo-job.config.json \
  --out output/my-set
```

### 2. Manual sync (if needed)

```bash
npx tsx scripts/line-sticker/sync-upload-input.mts \
  --source output/my-set \
  --config skills/line-sticker-maker/examples/demo-job.config.json
```

### 3. Upload to LINE

```bash
npx tsx scripts/line-sticker/run-line-upload.mts \
  --env output/my-set/.env.batch/Set_Name.env
```

Visible browser and save pauses are **opt-in** via `--interactive true` on `run-line-upload.mts`.
Default: headless Playwright, no Enter prompts, ZIP pause 0s. Automatic submission
must remain disabled unless the user explicitly requests review submission.

Single step:

```bash
npx tsx .../run-line-upload.mts --env <out>/.env.batch/Set_Name.env --step gdrive
npx tsx .../run-line-upload.mts --env <out>/.env.batch/Set_Name.env --step provision
npx tsx .../run-line-upload.mts --env <out>/.env.batch/Set_Name.env --step zip
npx tsx .../run-line-upload.mts --env <out>/.env.batch/Set_Name.env --step submit
```

## Pipeline order (do not skip)

| Step | Script | Purpose |
|------|--------|---------|
| 1 | `upload_gdrive.py --stage` | Upload ZIP + sprite sheets → Drive share URL |
| 2 | `provision_line_sticker.py` | Fill Creators Market form → `LINE_STICKER_ID` |
| 3 | `upload_line_zip.py` | Upload 42-PNG ZIP on image edit page |
| 4 | `submit_line_review.py` | Submit for review → prints `PROJECT_URL=` |

All Python scripts require `--env <out>/.env.batch/Set_Name.env` (credentials merged if you use `run-line-upload.mts`).

### Batch upload (multiple sets)

```bash
uv run --locked python skills/line-sticker-upload/scripts/batch_submit_sticker_sets.py \
  .line-upload/input/706
```

Uses `credentials.env` + writes batch env files under `.line-upload/.env.batch/`.

## Upload root layout

```text
.line-upload/
  input/706/{Set Name}/
    {Set Name}.zip
    {Set Name}.md
    sprite_sheets/
```

## Secrets (never commit)

- `.secrets/line-sticker/credentials.env`
- `.secrets/line-sticker/upload.env` (legacy)
- `<out>/.env.batch/*.env` (may contain runtime IDs after provision)
- `.line-upload/state/playwright_line_state*.json`
- `.secrets/line-sticker/gdrive_token.json`
- `.secrets/line-sticker/gdrive_credentials.json`
