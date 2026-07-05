---
name: line-sticker-maker
description: Generate a complete LINE sticker set from a single character reference image, fully headless (no browser). Reuses the app's prompt builder + shared chroma-key core to produce a sprite sheet via Gemini, remove the chroma background, slice it into individual transparent sticker PNGs, and package a LINE Creators Market upload ZIP. Use when the user wants to "make LINE stickers", "produce a sticker set", "生成貼圖 / 做一套貼圖" from a reference image.
---

# LINE Sticker Maker

Headless version of this project's LINE sticker workflow. Given one character
reference image, it generates a sprite sheet with Gemini, removes the chroma-key
background, slices it into individual transparent sticker PNGs, and (in set mode)
builds a **LINE Creators Market upload ZIP** — all from the command line, no
browser/UI.

It **reuses the app's own modules** (`utils/lineStickerPrompt.ts`,
`utils/lineStickerSetSchema.ts`, `utils/chromaKeyCore.ts`,
`utils/lineStickerUploadSpec.ts`) so output matches the web app. Only the browser
Canvas layer is replaced with `upng-js`. Native-resolution slices are kept for
debug; upload assets are resized to LINE specs.

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
5. Point the user to **`line-upload.zip`** for LINE Creators Market → Stickers →
   **ZIP file upload**.

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
| `scope` | `set` | `set` = full LINE set; `single` = one sheet |
| `stickerCount` | `40` | **set mode only**. `40` = 2 sheets × 4×5 (LINE 上架標準); `48` = 3 sheets × 4×4 (legacy) |
| `cols` / `rows` | `4` / `6` | **single mode only** grid size |
| `model` | `gemini-3.1-flash-lite-image` | image model id |
| `resolution` | `1K` | output resolution; `0.5K`/`1K`/`2K`/`4K` for 3.1-flash, `1K` for 3.1-flash-lite / 2.5-flash. Auto-dropped if the model rejects it. |
| `lineUpload` | `true` in set mode | when `true`, emit `line-upload/` + `line-upload.zip` for LINE Creators Market |
| `mainStickerIndex` | `1` | 1-based index for `main.png` (240×240) |
| `tabStickerIndex` | `1` | 1-based index for `tab.png` (96×74) |
| `lineUploadStickerCount` | auto | override upload count (`8`/`16`/`24`/`32`/`40`); default `40` when 48 stickers are produced |

## Output

```
<out>/
  manifest.json                 # all stickers + phrases + pixel sizes
  line-upload.zip               # ★ upload this to LINE Creators Market
  line-upload/
    main.png                    # 240×240
    tab.png                     # 96×74
    01.png ... 40.png           # each ≤370×320, even dimensions, transparent PNG
  stickers/
    sticker-01.png ...          # flat folder (native resolution)
  sheet-1/
    _raw-sheet.png              # raw Gemini sheet (debug)
    _processed-sheet.png        # after chroma removal (debug)
    sticker-01.png ...          # per-sheet slices (native resolution)
  sheet-2/ ...                  # (40-sticker set = 2 sheets)
```

### LINE upload ZIP contents

File names must match LINE's bulk-upload convention:

| File | Size | Role |
|---|---|---|
| `main.png` | 240×240 | Shop main image |
| `tab.png` | 96×74 | Chat sticker tab icon |
| `01.png`–`40.png` | max 370×320 (even px) | Sticker images |

Upload at [LINE Creators Market](https://creator.line.me/) → Stickers → edit images →
**ZIP file upload**. Select sticker count (40) to match before uploading.

## Notes / limits

- **Sprite sheet size**: LINE sticker generation always requests **1:1 @ 1K → 1024×1024 px**
  (4×5 grid → ~256×204 px per cell before inset; 4×4 → ~256×256).
- **Upload sizing**: `line-upload/` assets are scaled to fit LINE limits while
  keeping aspect ratio and transparent backgrounds. `stickers/` keeps native
  resolution for inspection.
- **No normalization step**: the shared chroma core auto-detects the dominant
  background. If a sheet shows colour residue, regenerate or tune `CHROMA_KEY_FUZZ`.
- Each sheet = one Gemini image call. A **40-sticker set = 2 calls**; legacy 48 = 3 calls.
- **48-sticker jobs**: upload pack uses the first **40** stickers by default (LINE standard).
- Gemini image models may return **JPEG**; the pipeline decodes PNG/JPEG and writes PNG.
- Each PNG should be ≤1 MB; ZIP ≤20 MB. Warnings are printed if limits are exceeded.
- **Not included**: title/description/price, creator account setup, or LINE review approval.
