---
name: line-sticker-character-ref
description: >-
  Generates LINE sticker character reference model sheets via Gemini image models.
  Sheet layout is defined by text (turnaround, expressions, detail insets) — no
  layout PNG attachment. Supports STYLE_PRESETS (--style chibi, yurukawa, etc.).
  Use when the user wants to 生成角色參考圖 / 角色設定圖 / character reference
  before phrase-design or line-sticker-pipeline.
---

# LINE Sticker Character Reference Generator

Produces a **character model sheet** (設定圖) for the sticker pipeline.

**Layout:** described in the prompt text only (no `model-sheet-layout.png` attachment — avoids copying stock mascot content into output).

Headless Gemini image generation; styles reuse **`utils/lineStickerPresets.ts`** → `STYLE_PRESETS`.

## Full flow

```
1. line-sticker-character-ref  →  character-ref.png
2. line-sticker-phrase-design  →  phrases.json
3. line-sticker-pipeline       →  stickers/
```

## Command

```bash
npx tsx .claude/skills/line-sticker-character-ref/scripts/generate-character-ref.mts \
  --concept "圓潤奶油色水獺，頑皮愛撒嬌，短手短腳" \
  --style yurukawa \
  --name "奶油獺" \
  --out output/refs/cream-otter.png
```

With identity lock (match uploaded character appearance):

```bash
npx tsx .claude/skills/line-sticker-character-ref/scripts/generate-character-ref.mts \
  --concept "長髮少女，白襯衫、佩斯利領帶" \
  --style matchUploaded \
  --identity-ref output/my-preview.png \
  --out output/twice-1-raw.png
```

### Flags

| flag | default | notes |
|---|---|---|
| `--concept` | required | Character description (species, personality, colors) |
| `--out` | required | Output PNG path |
| `--style` | `chibi` | Key from `STYLE_PRESETS` (see below); use `matchUploaded` with `--identity-ref` |
| `--style-context` | — | Custom style text (overrides preset) |
| `--name` | — | Character name for prompt title |
| `--identity-ref` | — | Optional image — lock species/palette/outfit |
| `--model` | `gemini-3.1-flash-lite-image` | Gemini image model (flash-lite default; 1K only) |
| `--resolution` | `1K` | `1K` for flash-lite; `gemini-3.1-flash-image` supports up to `4K` |
| `--dry-run` | off | Print prompt only |
| `--list-styles` | — | Print all style keys |

```bash
npx tsx .../generate-character-ref.mts --list-styles
npx tsx .../generate-character-ref.mts --concept "..." --style chibi --dry-run
```

## Style presets (`--style`)

Same keys as the web app / `line-sticker-maker` config:

| key | label |
|---|---|
| `chibi` | Q 版可愛 |
| `lineChibi` | 日系貼圖暖色 |
| `minimalist` | 極簡線條 |
| `yurukawa` | 慵懶軟懶風 |
| `anime` | 日系動漫 |
| `watercolor` | 手繪水彩 |
| `pastel` | 蠟筆粉彩 |
| `cartoon` | 美式卡通 |
| `flat` | 扁平時尚 |
| `doodle` | 塗鴉手繪 |
| `kidDoodle` | 五歲塗鴉 |
| `gouache` | 不透明水彩 |
| `pixel` | 像素藝術 |

Source: `utils/lineStickerPresets.ts`. `matchUploaded` works with `--identity-ref`.

Custom:

```bash
npx tsx .../generate-character-ref.mts \
  --concept "..." \
  --style-context "Soft crayon texture, warm brown palette, picture-book feel" \
  --out output/refs/custom.png
```

## Text layout (prompt-defined panels)

`utils/characterRefPrompt.ts` → `CHARACTER_REF_SHEET_LAYOUT_TEXT`:

- Full-body **front / side / back** turnaround (top row)
- **4 expression** headshots
- **Detail row**: face close-up, relaxed full-body pose, outfit/accessory inset, optional personality vignette

No layout image is sent to Gemini — only optional `--identity-ref` for appearance lock.

## Agent workflow

```
Character ref:
- [ ] 1. Gather concept + style (+ optional identity sketch)
- [ ] 2. GEMINI_API_KEY ready
- [ ] 3. --dry-run to review prompt
- [ ] 4. Generate PNG
- [ ] 5. User approves reference image
- [ ] 6. phrase-design → pipeline with --image <out>
```

### Example follow-up

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image output/refs/cream-otter.png \
  --phrase-set output/cream-otter/phrases.json \
  --out output/cream-otter
```

## Related skills

| skill | role |
|---|---|
| `line-sticker-phrase-design` | phrases.json |
| `line-sticker-pipeline` | image + JSON → stickers |
| `line-sticker-maker` | low-level generate scripts |

## API key

`GEMINI_API_KEY` in env or repo `.env` / `.env.local`.
