---
name: line-sticker-phrase-design
description: >-
  Designs and validates line-sticker-phrase-set JSON, using a voice preset or
  custom tone. Use for 貼圖文案、phrase-set JSON、語氣風格, action descriptions,
  or repairing an existing phrase set. This skill does not generate sticker
  images or upload packages.
---

# LINE Sticker Phrase Design

Produces the phrase/action JSON consumed by `line-sticker-pipeline`.

## Required inputs

- Theme or free-text context
- Language (`zh-TW` by default)
- Voice preset or custom voice context
- Pack size (`40` by default) and optional character/set name

If the user has not specified a tone, choose a fitting preset and state the
choice. Read [phrase guidelines](references/phrase-guidelines.md) when choosing a
voice, tuning quality, hand-authoring JSON, or using advanced flags.

## Design

```bash
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --theme daily --voice nishimura --mode set --count 40 \
  --language zh-TW --name "奶油貓日常" \
  --out output/my-set/phrases.json
```

Custom theme and voice:

```bash
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --theme-context "情侶撒嬌日常" \
  --voice-context "溫柔、短句、帶一點調皮" \
  --out output/love-set/phrases.json
```

This makes a Gemini text call. For inspection/planning requests, draft examples
or use validation only; do not infer permission to call the API.

## Validate

Always validate before image generation:

```bash
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --validate output/my-set/phrases.json
```

The output must use `format: "line-sticker-phrase-set"`, `version: 1`, and equal
length `phrases` / `actionDescs` arrays. A phrase may be empty for a visual-only
sticker. Non-empty Traditional Chinese captions are short, sendable chat fragments;
actions are concrete, drawable English descriptions.

## Review and handoff

1. Show the user 5–8 representative phrase/action pairs, including visual-only
   slots when present.
2. Apply requested tone changes and validate again.
3. Return the JSON path.
4. Invoke `line-sticker-pipeline` only if the user also asked to generate images.

List live presets rather than relying on a copied table:

```bash
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts --list-voices
```

API key: `GEMINI_API_KEY` in the environment or repo `.env` / `.env.local`.
