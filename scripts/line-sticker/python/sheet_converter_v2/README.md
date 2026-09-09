# ChatGPT Sticker Sheet Converter V2

**Additive** Python pipeline for light-background 4×5 sticker sheets.
It does **not** replace TypeScript chroma (`legacy` / `core` / `forge`) or
headless slice modes (`template` / `detect` / `divider`).

## When to use

| Input | Prefer |
|-------|--------|
| Gemini guided **green/magenta** chroma sheets | Existing TS pipeline (`scripts/line-sticker/generate.mts`) |
| ChatGPT / soft **paper-white** or solid-chroma 4×5 sheets | **This V2 converter** (default keys once) |
| Sheets **already transparent / 已去背** | V2 with **`--already-keyed`** (slice only — do not re-key) |

## Pipeline

1. Estimate background RGB from border samples *(skipped if already keyed)*  
2. Flood-fill key (border-connected only — keeps interior props) *(skipped if already keyed)*  
3. Morphological close (reconnect thin sweat / motion lines) *(skipped if already keyed)*  
4. Edge decontaminate (reduce gray fringe) *(skipped if already keyed)*  
5. Projection-histogram grid cuts — valley-band center + per-column row median (fallback: equal grid)  
6. Adaptive cell inset (skip shrink on soft-touch gutters)  
7. Connected-component cell extract (avoid neighbor bleed; keep soft AA)  
8. Fit to LINE 370×320, write transparent PNG (+ optional ZIP)

## Install

```bash
uv sync --locked --dev
```

## Usage

```bash
# Self-check
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py --self-check

# Single sheet → 20 PNGs (keys background)
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --sheet path/to/4x5.png \
  --out output/my-set

# Already background-removed → slice only
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --sheet path/to/4x5-transparent.png \
  --out output/my-set \
  --already-keyed

# Batch
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --input input/ \
  --output output/ \
  --zip

# Or via thin TS wrapper
npx tsx scripts/line-sticker/convert-sheet-v2.mts --sheet path/to/4x5.png --out output/my-set
npx tsx scripts/line-sticker/convert-sheet-v2.mts \
  --sheet path/to/keyed.png --out output/my-set --already-keyed
```

## Flags

| flag | meaning |
|------|---------|
| `--cols` / `--rows` | default `4` / `5` |
| `--equal-grid` | skip histogram cuts |
| `--no-line-fit` | skip 370×320 fit |
| `--start-index` | first sticker number |
| `--already-keyed` | skip background keying (已去背 / transparent sheet) |
| `--force-key` | always key even if alpha is already present |
| `--zip` | batch: write `stickers_v2.zip` |

With no keying flag, sheets that already have ≥2% transparent pixels auto-skip keying.
