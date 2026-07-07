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

## Setup (once)

```bash
pip install -r .claude/skills/line-sticker-upload/scripts/requirements-gdrive.txt
pip install -r .claude/skills/line-sticker-upload/scripts/requirements-playwright.txt
playwright install chromium
cp .claude/skills/line-sticker-upload/.env.example .claude/skills/line-sticker-upload/.env
# Or fill .claude/skills/line-sticker-maker/credentials.env for shared creds
```

## Workflow with line-sticker-maker

```text
line-sticker-maker (generate.mts)
  → example/output/pX/                  ← local pack (zip, md, sprite_sheets)
  → sync-line-upload-input (auto by default)
  → .line-upload/input/706/{Set Name}/
  → example/output/pX/.env.batch/{Set_Name}.env
  → run-line-upload.mts                 ← Drive + LINE Creators Market
```

### 1. Generate stickers

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/generate.mts \
  --config .claude/skills/line-sticker-maker/example/p4-job.config.json \
  --out .claude/skills/line-sticker-maker/example/output/p4
```

### 2. Manual sync (if needed)

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/sync-line-upload-input.mts \
  --source .claude/skills/line-sticker-maker/example/output/p4 \
  --config .claude/skills/line-sticker-maker/example/p4-job.config.json
```

### 3. Upload to LINE

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts \
  --env .claude/skills/line-sticker-maker/example/output/p4/.env.batch/Cozy_Cream_Cat_Daily_Chat.env
```

Visible browser is the default. For automation, add `--headless true`.

Single step:

```bash
npx tsx .../run-line-upload.mts --env example/output/pX/.env.batch/Set_Name.env --step gdrive
npx tsx .../run-line-upload.mts --env example/output/pX/.env.batch/Set_Name.env --step provision
npx tsx .../run-line-upload.mts --env example/output/pX/.env.batch/Set_Name.env --step zip
npx tsx .../run-line-upload.mts --env example/output/pX/.env.batch/Set_Name.env --step submit
```

## Pipeline order (do not skip)

| Step | Script | Purpose |
|------|--------|---------|
| 1 | `upload_gdrive.py --stage` | Upload ZIP + sprite sheets → Drive share URL |
| 2 | `provision_line_sticker.py` | Fill Creators Market form → `LINE_STICKER_ID` |
| 3 | `upload_line_zip.py` | Upload 42-PNG ZIP on image edit page |
| 4 | `submit_line_review.py` | Submit for review → prints `PROJECT_URL=` |

All Python scripts can be run directly with `--env <batch env path>`.

## Upload root layout

```text
.line-upload/
  input/706/{Set Name}/
    {Set Name}.zip
    {Set Name}.md
    sprite_sheets/
```

## Secrets (never commit)

- `.claude/skills/line-sticker-upload/.env`
- `.claude/skills/line-sticker-maker/credentials.env`
- `example/output/*/.env.batch/`
- `.claude/skills/line-sticker-upload/scripts/playwright_line_state.json`
- `.claude/skills/line-sticker-upload/scripts/gdrive_token.json`
- `.claude/skills/line-sticker-upload/scripts/gdrive_credentials.json`
