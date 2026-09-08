# Phrase design guidelines

## Output shape

```json
{
  "format": "line-sticker-phrase-set",
  "version": 1,
  "mode": "set",
  "name": "奶油貓日常",
  "phrases": ["早安", "", "晚安"],
  "actionDescs": ["waving hello", "laughing with closed eyes", "sleepy yawn"]
}
```

- `set` defaults to 40 slots; `single` uses `gridCols × gridRows`.
- Empty phrases are intentional visual-only stickers.
- `phrases.length` and `actionDescs.length` must match.
- Validate every hand-written or edited file with `--validate`.

## Quality rules

- Traditional Chinese captions: usually 3–5 characters, maximum 5.
- English captions: one or two words.
- Make every non-empty caption a tap-to-send chat fragment, not an announcement.
- Use one emotional beat per sticker; avoid emoji and decorative punctuation.
- Mix captioned and visual-only reactions; avoid duplicate phrases.
- Actions: 3–8 English words, visibly distinct, concrete, and aligned to meaning.

The implementation sources are `utils/lineStickerPhraseQuality.ts` and
`utils/lineStickerPhraseSetFormat.ts`.

## Voice and theme discovery

Use the script to list current voice names and Chinese aliases:

```bash
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts --list-voices
```

Common voices include `nishimura`, `minimal`, `meme`, `sweet`, `workplace`,
`dramatic`, `penguin`, `capoo`, and `kana`. The source of truth is
`utils/lineStickerVoicePresets.ts`; theme presets live in
`utils/lineStickerPresets.ts`.

## Advanced operations

```bash
# Preset phrases; action descriptions still use Gemini unless --no-actions
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --theme daily --preset-only --count 40 --out output/daily/phrases.json

# One 4×5 sheet
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --theme emotion --mode single --cols 4 --rows 5 --out output/test/phrases.json

# Refresh action descriptions only
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts \
  --actions-only path/to/phrases.json --theme-context "日常聊天" \
  --out path/to/phrases-with-actions.json
```

Supported set counts are 32, 40, and 48. Useful flags include `--character`,
`--name`, `--language`, `--voice-context`, `--preset-only`, and `--no-actions`.

Shop-copy limits are enforced later by listing normalization: Traditional Chinese
title 20 characters and description 80; English title under 40 ASCII characters
and description up to 160. Keep internal pipeline labels out of customer-facing
copy.
