# ChatGPT Sticker Sheet Converter V2

Additive Python pipeline for **ChatGPT / similar** 4×5 sticker sheets
(paper background or already-keyed transparent sheets).

The TypeScript wrapper follows the shared headless contract: use `--help`, pass
paths relative to the repository root, and expect exit code `2` for invalid CLI
arguments (instead of a conversion failure).

> Does **not** replace the TypeScript chroma + slice stack used for Gemini
> green/magenta guided sheets. Keep using `scripts/line-sticker/generate.mts`
> / `reslice-sheet.mts` for those.

Full README: [`scripts/line-sticker/python/sheet_converter_v2/README.md`](../../scripts/line-sticker/python/sheet_converter_v2/README.md)

## Quick start

```bash
uv sync --locked --dev

uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py --self-check

# Opaque paper / solid chroma → key + slice
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --sheet path/to/4x5.png \
  --out output/my-set

# Already transparent / 已去背 → slice only (do not re-key)
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --sheet path/to/4x5-transparent.png \
  --out output/my-set \
  --already-keyed

# batch
uv run --locked python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --input input/ --output output/ --zip

# TS spawn wrapper
npx tsx scripts/line-sticker/convert-sheet-v2.mts --sheet path/to/4x5.png --out output/my-set
npx tsx scripts/line-sticker/convert-sheet-v2.mts --sheet path/to/keyed.png --out output/my-set --already-keyed
```

## When to skip keying

| Situation | Flag |
|-----------|------|
| User says 已去背 / already keyed | `--already-keyed` |
| Re-slicing `_v2_keyed_sheet.png` / alpha PNG | `--already-keyed` (also auto-detected) |
| First pass on opaque paper/chroma sheet | default (key once) |
| Force key even if alpha exists | `--force-key` |

Auto behavior (no flag): if ≥2% of pixels are already transparent, keying is skipped.

## Algorithm (V2)

1. Auto estimate background from border median *(skipped when already keyed)*  
2. Flood-fill key (border-connected only) *(skipped when already keyed)*  
3. Morphological closing + edge decontaminate *(paper sheets only; skipped for dark/chroma and already-keyed)*  
4. Projection-histogram grid seams: prefer the **center of the widest low-density valley**, with per-column row detection + median merge  
5. **Adaptive cell inset** — only shrink into confirmed empty gutter; soft-touch valleys keep inset≈0 so white outlines are not carved  
6. Connected-component ownership (keep in-cell text/props; drop side-edge neighbor skims; preserve soft AA inside the cell)  
7. LINE fit 370×320 + transparent PNG (+ ZIP)

## Coexistence

| Backend | Path | Default for |
|---------|------|-------------|
| TS `legacy` / `core` / `forge` | `utils/chromaKey*.ts` + `nodeImage.mts` | Gemini chroma sheets |
| TS slice `template`/`detect`/`divider` | `nodeImage.mts` | Guided LINE pipeline |
| **Python V2** | `scripts/line-sticker/python/sheet_converter_v2/` | ChatGPT sheets (+ already-keyed slice) |
