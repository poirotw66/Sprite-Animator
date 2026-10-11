---
name: huahua-line-sticker-series
description: "Plan Huahua (花花) LINE sticker series, suggest a next theme, or produce Traditional Chinese phrase and action-description JSON sets. Use for this character's sticker concepts and text planning; image production and LINE upload require a separate explicit request."
---

# Huahua LINE Sticker Series

Turn a daily-life personality or situation into useful chat replies and distinct visual jokes for Huahua. Deliver a coherent series whose stickers work individually in LINE conversations.

In Sprite-Animator, the canonical source is `skills/huahua-line-sticker-series/`. Refresh generated agent mirrors with `npm run skills:sync:line-sticker` after edits; do not edit the mirrors directly.

## Character and scope

- Huahua is a calico cat with a deliberately rough MS Paint hand-drawn look. Preserve supplied character references; do not invent exact markings, proportions, or accessories as established canon.
- Use Traditional Chinese for titles, phrases, and action descriptions, with natural Taiwanese chat wording. Keep JSON keys and technical metadata in English.
- The source conversation moved away from sports toward everyday personality themes. Prefer that direction for an unspecified next series, but follow an explicit request for a different subject.
- The current request overrides these defaults. Do not turn older suggestions, assistant enthusiasm, or assertions about earlier releases into user-approved history.
- This skill delivers concepts and JSON. A cover concept is optional. Generate images only when requested, using an available image-generation workflow; inspect supplied visual references first. Do not imply that concepts are exported stickers, reviewed artwork, or published LINE products.

Read [references/series-context.md](references/series-context.md) when suggesting the next series, checking overlap, or interpreting the source's character direction. The skill can otherwise work offline without reopening the shared conversation.

## Choose the response mode

**Theme exploration / “next series?”**: Suggest a small shortlist, each with a title, one-sentence personality premise, a few representative phrases, and a visual joke. Explain how the strongest candidate differs from known series. Recommend a direction, then let the user choose; do not output a full pack unless requested.

**A selected theme / “make Huahua: ...”**: Produce the full requested set immediately. Unless a different size or format is specified, use the source convention of 40 stickers in two complementary groups of 20. Give the series a one-sentence premise and each group a short Traditional Chinese title, followed by one JSON object per group.

**Repair / extend an existing set**: Inspect the supplied phrases and matching actions first. Preserve its schema, count, and requested scope. For additions or a sequel, avoid duplicates against the supplied sets and explain any deliberate callback briefly.

## Build the series

1. Define the character's comic mechanism, not just the topic. For example, everyday incompetence means confidently taking the wrong action; gossip spectatorship means eagerly following events while claiming detachment.
2. Give the two groups different functions. The first can cover common opening replies and participation; the second can cover escalation, reversals, aftermath, or an ending. Adapt this split to the selected theme.
3. Write short, useful reply phrases before elaborating scenes. Prefer a few readable characters when natural; do not force a length limit at the expense of meaning. Remove filler, awkward wording, and unnecessary near-duplicates.
4. Pair every phrase with a concrete drawable action: pose, expression, main prop, and the visual punchline. Avoid descriptions that merely repeat the caption or state an invisible emotion.
5. Use a single readable key moment per sticker. Convert multi-step stories into a clear snapshot; imply motion with pose or simple motion lines. Keep supporting props sparse enough to read at sticker size. Before handoff, assign plausible roles to exactly two front paws, specify where props sit and touch, and keep the complete character in frame unless the user explicitly requests or accepts a bust. A cutting action must show the cut, not merely scissors held nearby.
6. Make scenes distinct through silhouette, expression, scale, or prop use. Do not give every phrase the same seated cat with a different caption. Preserve the character's identity across exaggerated reactions.
7. Treat the phrase as the main readable text. Use symbols or abstract bubbles for incidental phone messages and notes unless secondary text is essential. Keep compositions isolated and easy to crop; follow the user's background request.
8. Finish with a small number of standout stickers and, when useful, a concise cover concept. Omit this commentary if the user requests JSON only.

## JSON contract

Use exactly these fields for each group. Keep group titles outside the object. Example fragment with two items, not the default pack size:

```json
{
  "format": "line-sticker-phrase-set",
  "version": 1,
  "mode": "set",
  "phrases": ["有瓜？", "我只是路過"],
  "actionDescs": [
    "花花從大西瓜後探頭，雙耳豎起、眼睛發亮，貓掌握著一片西瓜",
    "花花踮腳假裝路過，身體朝前走，頭卻轉向八卦現場，尾巴勾著折疊椅"
  ]
}
```

- `phrases[i]` and `actionDescs[i]` describe the same sticker. Arrays must have equal lengths and contain nonempty strings.
- Keep `format`, `version`, and `mode` unchanged. Do not add title fields or wrap two groups in an invented schema unless the user requests a new contract.
- Use valid JSON: double quotes, no comments, no trailing commas. Preserve deliberate wording and punctuation.
- Check the requested count and duplicate phrases across the entire series. A repeated phrase is acceptable only when requested or necessary for a deliberate variant.

For saved JSON, run the dependency-free checker on one or more group files. These commands assume the Sprite-Animator repository root; outside that repository, resolve `scripts/validate_phrase_set.py` relative to this skill's directory:

```bash
python -B skills/huahua-line-sticker-series/scripts/validate_phrase_set.py group-1.json group-2.json
python -B skills/huahua-line-sticker-series/scripts/validate_phrase_set.py custom-group.json --expected-count 8
```

The default expected count is 20 per file. The checker verifies structure, counts, alignment, and exact phrase duplicates; it does not establish language quality, visual readability, or character fidelity. Review those manually before delivery. For inline output, perform the same structural checks before responding.

## Sprite-Animator handoff

Use this handoff when working in the Sprite-Animator repository. The two 20-item objects are the conversation's presentation format. This project's `utils/lineStickerPhraseSetFormat.ts` accepts exactly 40 items for `mode: set`; a single 20-item group cannot be imported as a full set. When an importable file is requested, concatenate group 1 then group 2 in both arrays into one 40-item object, preserving index alignment and the five-field contract. Validate it with the checker using `--expected-count 40`, then with the project's offline validator:

```bash
npx tsx skills/line-sticker-phrase-design/scripts/design-phrase-set.mts --validate output/huahua-set/phrases.json
```

Retain Traditional Chinese action descriptions for this conversation-based planning output. Do not silently apply another voice preset's English-action or visual-only defaults. Route to `line-sticker-pipeline` only when images are also requested, and read its `SKILL.md` before proceeding. Creating this skill or its JSON does not authorize paid generation, upload, or review submission.
