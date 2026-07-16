# ChatGPT Sticker Sheet Converter V2

**Additive** Python pipeline for light-background 4×5 sticker sheets.
It does **not** replace TypeScript chroma (`legacy` / `core` / `forge`) or
headless slice modes (`template` / `detect` / `divider`).

## When to use

| Input | Prefer |
|-------|--------|
| Gemini guided **green/magenta** chroma sheets | Existing TS pipeline (`scripts/line-sticker/generate.mts`) |
| ChatGPT / soft **paper-white** 4×5 sheets | **This V2 converter** |

## Pipeline

1. Estimate background RGB from border samples  
2. Flood-fill key (border-connected only — keeps interior props)  
3. Morphological close (reconnect thin sweat / motion lines)  
4. Edge decontaminate (reduce gray fringe)  
5. Projection-histogram grid cuts (fallback: equal grid)  
6. Connected-component cell extract (avoid neighbor bleed)  
7. Fit to LINE 370×320, write transparent PNG (+ optional ZIP)

## Install

```bash
pip install -r scripts/line-sticker/python/sheet_converter_v2/requirements.txt
```

## Usage

```bash
# Self-check
python scripts/line-sticker/python/sheet_converter_v2/convert.py --self-check

# Single sheet → 20 PNGs
python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --sheet path/to/4x5.png \
  --out output/my-set

# Batch
python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --input input/ \
  --output output/ \
  --zip

# Or via thin TS wrapper
npx tsx scripts/line-sticker/convert-sheet-v2.mts --sheet path/to/4x5.png --out output/my-set
```

## Flags

| flag | meaning |
|------|---------|
| `--cols` / `--rows` | default `4` / `5` |
| `--equal-grid` | skip histogram cuts |
| `--no-line-fit` | skip 370×320 fit |
| `--start-index` | first sticker number |
| `--zip` | batch: write `stickers_v2.zip` |
