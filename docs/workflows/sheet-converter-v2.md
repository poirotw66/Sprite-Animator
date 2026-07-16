# ChatGPT Sticker Sheet Converter V2

Additive Python pipeline for **light-background** 4×5 sticker sheets
(ChatGPT / similar generators).

> Does **not** replace the TypeScript chroma + slice stack used for Gemini
> green/magenta guided sheets. Keep using `scripts/line-sticker/generate.mts`
> / `reslice-sheet.mts` for those.

Full README: [`scripts/line-sticker/python/sheet_converter_v2/README.md`](../../scripts/line-sticker/python/sheet_converter_v2/README.md)

## Quick start

```bash
pip install -r scripts/line-sticker/python/sheet_converter_v2/requirements.txt

python scripts/line-sticker/python/sheet_converter_v2/convert.py --self-check

python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --sheet path/to/4x5.png \
  --out output/my-set

# batch
python scripts/line-sticker/python/sheet_converter_v2/convert.py \
  --input input/ --output output/ --zip

# TS spawn wrapper
npx tsx scripts/line-sticker/convert-sheet-v2.mts --sheet path/to/4x5.png --out output/my-set
```

## Algorithm (V2)

1. Auto estimate background from border median  
2. Flood-fill key (border-connected only)  
3. Morphological closing (thin feature reconnect)  
4. Edge decontaminate  
5. Projection-histogram grid seams (or `--equal-grid`)  
6. Connected-component cell extract  
7. LINE fit 370×320 + transparent PNG (+ ZIP)

## Coexistence

| Backend | Path | Default for |
|---------|------|-------------|
| TS `legacy` / `core` / `forge` | `utils/chromaKey*.ts` + `nodeImage.mts` | Gemini chroma sheets |
| TS slice `template`/`detect`/`divider` | `nodeImage.mts` | Guided LINE pipeline |
| **Python V2** | `scripts/line-sticker/python/sheet_converter_v2/` | Paper-bg ChatGPT sheets |
