---
name: line-sticker-phrase-design
description: >-
  Designs line-sticker-phrase-set JSON with selectable voice presets (nishimura,
  meme, sweet, workplace, etc.) or custom --voice-context. Validates on-sticker
  legibility, outputs for line-sticker-pipeline. Use when the user wants to 設計貼圖文案
  / 產生 phrase-set JSON / 選擇貼圖語氣風格 before generating images.
---

# LINE Sticker Phrase Design

Creates the **designed JSON** (phrase-set) that `line-sticker-pipeline` consumes.
Headless; reuses `services/gemini/stickerPhrases.ts` and `actionDescriptions.ts`.

## Output format

```json
{
  "format": "line-sticker-phrase-set",
  "version": 1,
  "mode": "set",
  "name": "奶油貓日常",
  "phrases": ["早安", "晚安", "..."],
  "actionDescs": ["waving good morning", "sleepy yawn", "..."]
}
```

| field | rules |
|---|---|
| `mode` | `set` = full pack (default 40 phrases); `single` = one sheet (`gridCols` × `gridRows`) |
| `phrases` | **Sticker slots** — each entry is either a **sendable chat caption** (zh: **3–5 字**, max 5; en: 1–2 words) **or** `""` for **visual-only** (no on-image text, expression/gesture only) |
| `actionDescs` | English pose/expression per phrase; same length as `phrases` |
| `name` | Optional display name for the set |

Schema: `utils/lineStickerPhraseSetFormat.ts`  
Caption quality: `utils/lineStickerPhraseQuality.ts`  
Example: `example/daily-set-40.json`

## Voice presets (`--voice`)

Default: **`nishimura`**（西村戲謔風）

**不必記英文 key** — 可直接用中文：

```bash
npx tsx .../design-phrase-set.mts --theme 日常 --voice 企鵝 --out output/企鵝日常/phrases.json
npx tsx .../design-phrase-set.mts --theme 美食 --voice 咖波 --out output/咖波吃貨/phrases.json
```

列出全部風格：`npx tsx .../design-phrase-set.mts --list-voices`

| 貼圖組風格（中文） | `--voice` 可填 | 參考 |
|---|---|---|
| 戲謔風（預設） | `nishimura` / `戲謔` / `西村` | [NishimuraYuji](https://store.line.me/stickershop/author/2897044/zh-Hant) |
| 極簡反應 | `minimal` / `極簡` | 單字快捷回覆 |
| 迷因梗圖 | `meme` / `迷因` / `梗圖` | 台灣網路梗 |
| 撒嬌軟萌 | `sweet` / `撒嬌` | 討抱抱語氣 |
| 職場冷幽默 | `workplace` / `職場幽默` / `社畜` | 社畜感 |
| 情緒爆發 | `dramatic` / `爆發` | 誇張大表情 |
| 企鵝療癒風 | `penguin` / `企鵝` | [企鵝家族心情日常](https://store.line.me/stickershop/product/37301/zh-Hant) |
| 咖波風 | `capoo` / `咖波` | [咖波](https://store.line.me/search/zh-Hant?q=%E5%92%96%E6%B3%A2) |
| 卡娜風 | `kana` / `卡娜` | [卡娜](https://store.line.me/search/zh-Hant?q=%E5%8D%A1%E5%A8%9C) |

### 貼圖組中文名稱（`name` / 商店標題）

未指定 `--name` 時，腳本會自動產生，例如：

- `日常聊天·企鵝療癒風`
- `奶油獺·日常聊天`（加 `--character 奶油獺`）

此名稱寫入 phrase-set 的 `name`，並在 pipeline 中作為 **`titleZh`**（LINE 商店標題）。

**LINE 官方字數上限（自動裁切）：**

| 欄位 | 上限 |
|------|------|
| 中文標題 `titleZh` | 20 字 |
| 中文說明 `descZh` | 80 字 |
| 英文標題 `titleEn` | 39 字元（半形） |
| 英文說明 `descEn` | 160 字元（須含 `Sticker set.`） |

腳本會自動產生簡短、吸睛且合規的標題／說明；過長時會裁切並在 log 提示。

```bash
# 企鵝家族心情日常風
npx tsx .../design-phrase-set.mts --theme 日常 --voice 企鵝 --out output/企鵝日常/phrases.json

# 咖波風
npx tsx .../design-phrase-set.mts --theme 美食 --voice 咖波 --out output/咖波吃貨/phrases.json

# 卡娜風 + 角色名
npx tsx .../design-phrase-set.mts --theme 日常 --voice 卡娜 --character 小狐 --out output/小狐日常/phrases.json

# 撒嬌風 + 戀愛主題
npx tsx .../design-phrase-set.mts \
  --theme-context "情侶撒嬌日常" --voice sweet --out output/love/phrases.json

# 完全自訂語氣（覆蓋 preset）
npx tsx .../design-phrase-set.mts \
  --theme daily --voice-context "老公俠火力全開：吐槽老婆、裝傻、假正經" \
  --out output/husband/phrases.json
```

### 新增 voice preset

編輯 **`utils/lineStickerVoicePresets.ts`** → `STICKER_VOICE_PRESETS` 加一筆：

```typescript
myVoice: {
  label: '我的風格',
  intro: 'One-line persona for Gemini.',
  rules: `- bullet rules for tone`,
  goodExamples: ['範例一', '範例二'],
  badExamples: ['請稍候', '已完成'],
  lengthHint: 'optional — override length guidance',
},
```

然後 `--voice myVoice` 即可。不需改腳本。

## Commands

### AI design (recommended)

```bash
npx tsx .claude/skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --theme daily \
  --mode set --count 40 \
  --language zh-TW \
  --name "奶油貓日常" \
  --out output/my-set/phrases.json
```

Custom theme:

```bash
npx tsx .../design-phrase-set.mts \
  --theme-context "戀愛撒嬌、情侶日常、吃醋與甜蜜" \
  --mode set --count 40 \
  --language zh-TW \
  --name "戀愛篇" \
  --out output/love-set/phrases.json
```

### Preset only (no phrase AI — cycles theme examples)

```bash
npx tsx .../design-phrase-set.mts \
  --theme daily --preset-only \
  --mode set --count 40 \
  --out output/daily-preset/phrases.json
```

Still calls Gemini for `actionDescs` unless `--no-actions`.

### Single sheet (e.g. 4×5 test grid)

```bash
npx tsx .../design-phrase-set.mts \
  --theme emotion \
  --mode single --cols 4 --rows 5 \
  --language zh-TW \
  --out output/single-sheet/phrases.json
```

### Validate existing JSON

```bash
npx tsx .../design-phrase-set.mts --validate path/to/phrases.json
```

### Add / refresh actionDescs only

```bash
npx tsx .../design-phrase-set.mts \
  --actions-only path/to/phrases.json \
  --theme-context "日常聊天" \
  --out path/to/phrases-with-actions.json
```

## Theme presets

| key | label |
|---|---|
| `daily` | 日常聊天 |
| `social` | 社群互動 |
| `workplace` | 職場對話 |
| `emotion` | 情緒表現 |
| `meme` | 迷因梗圖 |
| `food` | 美食饕客 |

Source: `utils/lineStickerPresets.ts` → `THEME_PRESETS`

## Agent workflow

```
Design:
- [ ] 1. Clarify theme, language, count (40 default), character vibe
- [ ] 2. Run design-phrase-set.mts (or hand-write JSON following rules)
- [ ] 3. --validate the output
- [ ] 4. Show user 5–8 sample phrase/action pairs for approval
- [ ] 5. Hand off to line-sticker-pipeline (image + phrases.json)
```

### Step 1 — Gather (ask only what's missing)

- **Theme**: preset key or free-text (`--theme-context`)
- **Language**: `zh-TW` (default), `zh-CN`, `en`, `ja`
- **Size**: `set` + `--count 40` (LINE standard) or `single` grid
- **Set name** (`--name`): Traditional Chinese title; omit to auto-generate e.g. `日常聊天·戲謔風`
- **Character name** (`--character`): optional; prefixes set name e.g. `奶油獺·日常聊天`

### Step 2 — Design

Prefer **Gemini** (`design-phrase-set.mts`) for full 40-phrase packs.  
For small edits, patch the JSON directly then `--validate`.

**Phrase rules** (voice preset + `lineStickerPhraseQuality.ts`):

- Pick **`--voice`** or **`--voice-context`** to set tone
- Mix **captioned** slots and **visual-only** slots (`""`); AI targets ~30% visual-only via `[無字]` marker
- Non-empty captions must be **tap-to-send LINE chat fragments** — witty, relatable, voice-matched
- On-sticker captions: zh max **5 字**; match voice (戲謔 / 極短 / 撒嬌 / …)
- One beat per sticker; no 公告語氣
- No emojis or decorative punctuation

**Action rules**:

- 3–8 English words, concrete and drawable
- Visually distinct poses across the pack
- Match phrase meaning (illustrator draws from this)

### Step 3 — Validate

Always run `--validate` before generation.

### Step 4 — User spot-check

Show a short sample table:

| # | phrase | action |
|---|--------|--------|
| 1 | 早安 | waving good morning |
| 5 | *(visual-only)* | laughing with closed eyes |
| … | … | … |

Ask for theme/tone tweaks before running Gemini image generation.

### Step 5 — Pipeline

```bash
npx tsx .claude/skills/line-sticker-maker/scripts/run-from-inputs.mts \
  --image path/to/character.png \
  --phrase-set output/my-set/phrases.json \
  --out output/my-set
```

See **`.claude/skills/line-sticker-pipeline/SKILL.md`**.

## Flags reference

| flag | default | notes |
|---|---|---|
| `--theme` | — | `daily`, `social`, `workplace`, `emotion`, `meme`, `food` |
| `--theme-context` | — | custom theme (overrides preset label) |
| `--mode` | `set` | `set` or `single` |
| `--count` | `40` | set mode phrase count (32 / 40 / 48) |
| `--cols` / `--rows` | `4` / `5` | single mode grid |
| `--language` | `zh-TW` | `zh-TW`, `zh-CN`, `en`, `ja` |
| `--voice` | `nishimura` | voice key **or** 中文（企鵝、咖波、戲謔…）；`--list-voices` 查表 |
| `--character` | — | 角色名，用於自動 `--name` |
| `--voice-context` | — | custom voice text (overrides preset) |
| `--preset-only` | off | cycle preset examples, no phrase AI |
| `--no-actions` | off | skip actionDescs generation |
| `--out` | required | output `.json` path |

API key: `GEMINI_API_KEY` env or repo `.env` / `.env.local`.

## Hand-written JSON

When writing JSON without the script:

1. Set `format` + `version` exactly as above
2. Keep `phrases.length === actionDescs.length` (single mode)
3. Run `--validate` before pipeline
4. Prefer **40 phrases** for standard LINE sets

## Related skills

| skill | role |
|---|---|
| `line-sticker-pipeline` | image + phrase-set → stickers |
| `line-sticker-maker` | low-level generate scripts |
| `line-sticker-upload` | LINE Creators Market upload |
