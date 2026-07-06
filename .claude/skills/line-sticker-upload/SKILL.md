---
name: line-sticker-upload
description: >-
  LINE Creators Market upload pipeline (submodule line-s/): Google Drive staging,
  Playwright form provision, ZIP upload, submit for review. Use after
  line-sticker-maker produces a set — sync with sync-to-line-s.mts or auto-sync
  via lineS.syncToLineS, then run run-line-upload.mts. Source:
  https://github.com/poirotw66/line-stickers-upload-skill
---

# LINE Sticker Upload

Vendored as **`line-s/`** git submodule in this repo
([poirotw66/line-stickers-upload-skill](https://github.com/poirotw66/line-stickers-upload-skill)).

Playwright + Google Drive scripts live at:
`line-s/.cursor/skills/line-sticker-upload/scripts/`

## Setup (once)

```bash
git submodule update --init line-s
pip install -r line-s/.cursor/skills/line-sticker-upload/scripts/requirements-gdrive.txt
pip install -r line-s/.cursor/skills/line-sticker-upload/scripts/requirements-playwright.txt
playwright install chromium
cp line-s/.env.example line-s/.env
# Fill LINE_EMAIL, LINE_PASSWORD, LINE_CREATOR_ID, GOOGLE_* in line-s/.env
```

## Workflow with line-sticker-maker

```
line-sticker-maker (generate.mts)
  → example/output/pX/          ← local pack (zip, md, sprite_sheets)
  → sync-to-line-s (auto if lineS.syncToLineS)
  → line-s/input/706/{Set Name}/
  → line-s/.env.batch/{Set_Name}.env
  → run-line-upload.mts         ← Drive + LINE Creators Market
```

### 1. Generate stickers

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/generate.mts \
  --config .claude/skills/line-sticker-maker/example/p4-job.config.json \
  --out .claude/skills/line-sticker-maker/example/output/p4
```

Config `lineS` block sets titles; **`syncToLineS: true`** (default when `line-s/` exists)
copies the pack into the submodule after finalize.

### 2. Manual sync (if needed)

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/sync-to-line-s.mts \
  --source .claude/skills/line-sticker-maker/example/output/p4 \
  --config .claude/skills/line-sticker-maker/example/p4-job.config.json
```

### 3. Upload to LINE

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts \
  --env line-s/.env.batch/Cozy_Cream_Cat_Daily_Chat.env
```

Single step:

```bash
npx tsx .../run-line-upload.mts --env line-s/.env.batch/Set_Name.env --step gdrive
npx tsx .../run-line-upload.mts --env line-s/.env.batch/Set_Name.env --step provision
npx tsx .../run-line-upload.mts --env line-s/.env.batch/Set_Name.env --step zip
npx tsx .../run-line-upload.mts --env line-s/.env.batch/Set_Name.env --step submit
```

## Pipeline order (do not skip)

| Step | Script | Purpose |
|------|--------|---------|
| 1 | `upload_gdrive.py --stage` | Upload ZIP + sprite sheets → Drive share URL |
| 2 | `provision_line_sticker.py` | Fill Creators Market form → `LINE_STICKER_ID` |
| 3 | `upload_line_zip.py` | Upload 42-PNG ZIP on image edit page |
| 4 | `submit_line_review.py` | Submit for review → prints `PROJECT_URL=` |

All Python scripts run with **`cwd: line-s/`** and read **`line-s/.env`**.

## line-s folder layout (after sync)

```
line-s/
  input/706/{Set Name}/
    {Set Name}.zip
    {Set Name}.md
    sprite_sheets/
  .env.batch/{Set_Name}.env
  .env                    ← copied from .env.batch before upload
```

## Secrets (never commit)

- `line-s/.env`
- `line-s/.env.batch/` (local batch configs)
- `line-s/.cursor/skills/line-sticker-upload/scripts/playwright_line_state.json`
- `line-s/.cursor/skills/line-sticker-upload/scripts/gdrive_token.json`

## Full reference

See upstream skill doc:
`line-s/.cursor/skills/line-sticker-upload/SKILL.md`
