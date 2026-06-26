---
name: line-sticker-maker
description: Generate a complete LINE sticker set from a single character reference image, fully headless (no browser). Reuses the app's prompt builder + shared chroma-key core to produce a sprite sheet via Gemini, remove the chroma background, and slice it into individual transparent sticker PNGs at native resolution. Use when the user wants to "make LINE stickers", "produce a sticker set", "生成貼圖 / 做一套貼圖" from a reference image.
---

# LINE Sticker Maker

Headless version of this project's LINE sticker workflow. Given one character
reference image, it generates a sprite sheet with Gemini, removes the chroma-key
background, and slices it into individual transparent sticker PNGs — all from the
command line, no browser/UI.

It **reuses the app's own modules** (`utils/lineStickerPrompt.ts`,
`utils/lineStickerSetSchema.ts`, `utils/chromaKeyCore.ts`) so output matches the
web app. Only the browser Canvas layer is replaced with `upng-js`. Stickers keep
their **native resolution** (integer slicing, no resampling).

## How to run

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/generate.mts \
  --config <path/to/config.json> \
  --out <output-dir>
```

- `--dry-run` prints the assembled prompt + phrase list per sheet and writes
  nothing / calls no API. Use it to sanity-check a config first.
- The Gemini API key is read from `GEMINI_API_KEY` (env var), else the repo's
  `.env`, else `.env.local`. No flag needed.
- Run from the repo root. `node` is nvm-managed; if `node`/`npx` are not found,
  `source ~/.nvm/nvm.sh` first.

## Agent workflow

1. **Gather inputs** from the user (ask only for what's missing):
   - reference character image path (required)
   - sticker theme or a custom phrase list
   - language, art style, single sheet vs full set
2. **Write a `config.json`** (copy `config.example.json` as a starting point).
3. **Dry-run first** to verify prompt + phrases look right.
4. **Run for real**, then **Read a few output PNGs** to show the user results.

## config.json fields

| field | default | notes |
|---|---|---|
| `referenceImage` | — | path to the character reference (png/jpg/webp). Resolved relative to the config file, cwd, or repo root. |
| `characterDescription` | `""` | optional extra notes appended to the character rules |
| `style` | `matchUploaded` | `matchUploaded`, `chibi`, `pixel`, `minimalist`, `anime`, `cartoon`, `watercolor`, `yurukawa`, `pastel`, `flat`, `doodle` |
| `theme` | `daily` | `daily`, `social`, `workplace`, `emotion`, `meme` |
| `customPhrases` | `[]` | when non-empty, overrides the theme's phrases (one sticker per phrase, cycled to fill) |
| `language` | `zh-TW` | `zh-TW`, `zh-CN`, `en`, `ja` |
| `chromaKeyColor` | `green` | `magenta` or `green` (background to key out) |
| `includeText` | `true` | `true` = Gemini draws the phrase text; `false` = art only |
| `scope` | `set` | `set` = 3 sheets × 4×4 = 48 stickers; `single` = one sheet |
| `cols` / `rows` | `4` / `6` | **single mode only** grid size |
| `model` | `gemini-3.1-flash-image-preview` | image model id |
| `resolution` | `1K` | output resolution; `0.5K`/`1K`/`2K`/`4K` for 3.1-flash, `1K` for 2.5-flash. Auto-dropped if the model rejects it. |

## Output

```
<out>/
  manifest.json                 # all stickers + their phrases + pixel sizes
  sheet-1/
    _raw-sheet.png              # raw Gemini sheet (debug)
    _processed-sheet.png        # after chroma removal (debug)
    sticker-01.png ...          # individual transparent stickers (native res)
  sheet-2/ ...                  # (set mode)
```

## Notes / limits

- **Native resolution**: stickers are cropped at full pixel resolution. LINE's
  store spec (≤370×320) is **not** applied. Add a resize step later if needed.
- **No normalization step**: the shared chroma core auto-detects the dominant
  background, so the app's canvas-based `normalizeBackgroundColor` is skipped.
  If a sheet shows colour residue, regenerate or tune `CHROMA_KEY_FUZZ`.
- Each sheet = one Gemini image call. A full set = 3 calls; expect retries on
  rate limits (429/503) with exponential backoff.
- Gemini image models may return **JPEG** (e.g. 3.1-flash returns JPEG); the
  pipeline decodes PNG/JPEG by magic bytes (jpeg-js) and always writes the
  sliced stickers as transparent **PNG**.
- Verified end-to-end: 3.1-flash @1K returns a 1024×1024 sheet → 4×4 → stickers
  ~240×240 px, transparent background, 0% residual chroma.
