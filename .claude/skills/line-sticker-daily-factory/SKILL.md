---
name: line-sticker-daily-factory
description: >-
  Daily factory for 30 LINE sticker sets (2:1 B new characters / A theme rotation).
  Orchestrates backfill, planning, character-ref, phrase-design, and pipeline via
  daily-pack.mts and sticker-registry.json. Use when the user wants 日產 30 套、
  自動化工廠、daily-pack、量產貼圖.
---

# LINE Sticker Daily Factory

Headless **30-set-per-day** orchestrator built on existing skills:

```
backfill registry  →  plan batch  →  per slot:
  B: concept → character-ref → phrase-design → pipeline
  A: reuse ref → phrase-design → pipeline
  → sticker-registry.json
```

## Quick start

**Web UI:** Home → **貼圖產出履歷** (`/daily-sticker-registry`) — auto-loads `line-sticker-vault/registry/sticker-registry.json` via dev `/vault/` middleware; upload JSON manually otherwise.

```bash
# 1. Backfill existing output/ + preview today's plan (zero image API)
npx tsx .claude/skills/line-sticker-maker/scripts/daily-pack.mts \
  --backfill --plan-only

# 2. Run for real (resume skips completed sets)
npx tsx .claude/skills/line-sticker-maker/scripts/daily-pack.mts \
  --execute --resume

# 3. Test with one set
npx tsx .claude/skills/line-sticker-maker/scripts/daily-pack.mts \
  --execute --count 1
```

## Architecture

| Component | Path |
|-----------|------|
| Orchestrator | `.claude/skills/line-sticker-maker/scripts/daily-pack.mts` |
| Registry | `output/sticker-registry.json` |
| Backfill | `.claude/skills/line-sticker-maker/scripts/backfill-sticker-registry.mts` |
| Planner | `utils/dailyPackPlanner.ts` |
| Rotation pools | `utils/dailyPackPresets.ts` |
| Concept AI | `services/gemini/characterConcept.ts` |

### Batch ratio (default `2:1`)

- **B (20 sets)**: new character concept → `generate-character-ref.mts` → `design-phrase-set.mts` → `run-from-inputs.mts`
- **A (10 sets)**: pick completed B character from registry → new theme/voice phrases → pipeline with copied ref

Each 40-sticker set = **2 parallel Gemini sheet calls** (unchanged from `line-sticker-maker`).

## Output layout

```
output/
  sticker-registry.json
  2026-07-12/
    batch-plan.json
    batch-log.jsonl
    set-01/ … set-30/
      character-ref.png
      phrase-set.json
      stickers/ manifest.json …
```

## Vault archive (line-sticker-vault)

Sibling repo for long-term storage of character refs + phrase-set JSON.

```bash
# Archive completed output/ sets into ../line-sticker-vault
npx tsx .claude/skills/line-sticker-maker/scripts/archive-sync.mts --sync

# daily-pack merges vault registry for A-slot character rotation (auto-detects sibling vault)
npx tsx .claude/skills/line-sticker-maker/scripts/daily-pack.mts --backfill --plan-only
```

Disable vault: `--no-vault`. Custom path: `--vault /path/to/line-sticker-vault` or `STICKER_VAULT_ROOT`.

## Registry entry

```json
{
  "id": "SET-20260712-001",
  "date": "2026-07-12",
  "batchType": "B",
  "characterName": "舞棍狐",
  "characterConcept": "圓潤橘色狐狸，街頭塗鴉風，愛跳街舞",
  "style": "chibi",
  "theme": "meme",
  "voice": "nishimura",
  "refImagePath": "output/2026-07-12/set-01/character-ref.png",
  "outputDir": "output/2026-07-12/set-01",
  "status": "completed"
}
```

## Flags

| flag | default | notes |
|------|---------|-------|
| `--date` | today | `output/YYYY-MM-DD/` |
| `--count` | 30 | total sets |
| `--ratio` | `2:1` | B:A weight |
| `--backfill` | on | scan `output/` → registry before plan |
| `--plan-only` | off | write `batch-plan.json` only |
| `--execute` | off | required for real API calls |
| `--resume` | off | skip completed slots |
| `--from-set` | 1 | start at set N |
| `--no-backfill` | — | skip backfill step |

## Rotation pools

Defined in `utils/dailyPackPresets.ts`:

- **Themes**: daily, workplace, meme, food, couple, catSlaves
- **Voices**: nishimura, penguin, capoo, workplace, tsundere, positive, lieFlat, nihilistic, troll
- **Styles**: yurukawa, chibi, pixel, crayon→pastel, line-art→minimalist, watercolor, …

Same-batch rule: no duplicate `theme+voice` pair across 30 slots.

## Backfill only

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/backfill-sticker-registry.mts --dry-run
npx tsx .claude/skills/line-sticker-maker/scripts/backfill-sticker-registry.mts --merge
```

Detects completed sets (`manifest.json` + `stickers/sticker-01.png`). Earliest set per `characterName` → `batchType: B`; later sets → `A`.

## Agent workflow

```
Daily factory:
- [ ] 1. GEMINI_API_KEY ready
- [ ] 2. --backfill --plan-only → review batch-plan.json
- [ ] 3. --execute --resume
- [ ] 4. Spot-check 2–3 sets + registry entries
- [ ] 5. (Optional) line-sticker-upload per set
```

## Related skills

| skill | role |
|-------|------|
| `line-sticker-character-ref` | B-plan ref image |
| `line-sticker-phrase-design` | 40 phrases per set |
| `line-sticker-pipeline` | image + JSON → stickers |
| `line-sticker-upload` | LINE Creators Market |

## API key

`GEMINI_API_KEY` in env or repo `.env` / `.env.local`.
