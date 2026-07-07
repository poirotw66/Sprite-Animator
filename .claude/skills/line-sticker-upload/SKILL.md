---
name: line-sticker-upload
description: >-
  LINE Creators Market upload pipeline localized in this repo: Google Drive
  staging, Playwright form provision, ZIP upload, and submit-for-review.
  Use after line-sticker-maker produces a set.
---

# LINE Sticker Upload

Google Drive and Playwright scripts live at:
`.claude/skills/line-sticker-upload/scripts/`

## Environment files

Three files, three roles — do not mix secrets into the batch env by hand.

| File | Contains | Created by |
|------|----------|------------|
| `line-sticker-maker/credentials.env` | `LINE_EMAIL`, `LINE_PASSWORD`, `LINE_CREATOR_ID`, `GOOGLE_*`, `GDRIVE_PARENT_FOLDER` | You (once) — `credentials.env.example` |
| `<out>/.env.batch/{Set_Name}.env` | Shop titles, ZIP/sprite paths, runtime `LINE_STICKER_ID`, `GDRIVE_FOLDER_ID`, `GDRIVE_SHARE_URL` | `generate` / `finalize` / `sync-upload-input` |
| `line-sticker-upload/.env` | **Legacy** — all-in-one file for manual Python runs | Optional fallback if `credentials.env` missing |

**Normal flow:** fill `credentials.env` → run `run-line-upload.mts --env <batch>`.
The wrapper merges credentials into the batch file automatically.

`LINE_CREATOR_ID` is your Creators Market account ID from the URL:
`https://creator.line.me/my/{LINE_CREATOR_ID}/...`

`LINE_STICKER_ID` is written by `provision_line_sticker.py` into the batch env (not `credentials.env`).

OAuth / session artifacts (never commit):

- `scripts/gdrive_credentials.json` — Google Desktop OAuth client
- `scripts/gdrive_token.json` — Drive API token (auto-refreshed)
- `scripts/playwright_line_state.json` — LINE login session (auto-created)

## Setup (once)

```bash
pip install -r .claude/skills/line-sticker-upload/scripts/requirements-gdrive.txt
pip install -r .claude/skills/line-sticker-upload/scripts/requirements-playwright.txt
playwright install chromium

cp .claude/skills/line-sticker-maker/credentials.env.example \
   .claude/skills/line-sticker-maker/credentials.env
# fill LINE_EMAIL, LINE_PASSWORD, LINE_CREATOR_ID, GOOGLE_*
```

Place `gdrive_credentials.json` in `scripts/` (Google Cloud Console → Desktop OAuth).

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
npx tsx .claude/skills/line-sticker-maker/scripts/generate.mts \
  --config .claude/skills/line-sticker-maker/examples/demo-job.config.json \
  --out output/my-set
```

### 2. Manual sync (if needed)

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/sync-upload-input.mts \
  --source output/my-set \
  --config .claude/skills/line-sticker-maker/examples/demo-job.config.json
```

### 3. Upload to LINE

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts \
  --env output/my-set/.env.batch/Set_Name.env
```

Visible browser is the default. For automation, add `--headless true`.

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
python .claude/skills/line-sticker-upload/scripts/batch_submit_sticker_sets.py \
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

- `.claude/skills/line-sticker-maker/credentials.env`
- `.claude/skills/line-sticker-upload/.env` (legacy)
- `<out>/.env.batch/*.env` (may contain runtime IDs after provision)
- `scripts/playwright_line_state.json`, `gdrive_token.json`, `gdrive_credentials.json`
