# Documentation index

Technical docs are grouped by domain. Agent workflow guides live under `workflows/`.

## Workflows (headless factory)

- [LINE Sticker Pipeline](./workflows/line-sticker-pipeline.md) — image + phrase JSON → stickers
- [LINE Sticker Daily Factory](./workflows/line-sticker-daily-factory.md) — 30-set/day batch orchestration
- [ChatGPT Sheet Converter V2](./workflows/sheet-converter-v2.md) — additive Python flood-fill + smart cut (paper-bg sheets)

## Chroma / background

- [Chroma Key](./chroma/CHROMA_KEY.md)
- [Background Color Normalization](./chroma/BACKGROUND_COLOR_NORMALIZATION.md)
- [Quick Start Guide](./chroma/QUICK_START_GUIDE.md)

## Animation / slicing

- [Slice & Align Flow](./animation/SLICE_AND_ALIGN_FLOW.md)
- [Character Animation Prompt Options](./animation/CHARACTER_ANIMATION_PROMPT_OPTIONS.md)

## LINE stickers

- [Prompt Structure](./line-sticker/LINE_STICKER_PROMPT_STRUCTURE.md)
- [Prompt Example](./line-sticker/LINE_STICKER_PROMPT_EXAMPLE.md)

## Project

- [Optimization Report](./OPTIMIZATION_REPORT.md)
- [Optimization Roadmap](./PROJECT_OPTIMIZATION_ROADMAP.md)
- [Credential Rotation Checklist](./CREDENTIAL_ROTATION_CHECKLIST.md)
- [Browser Font Assets](./BROWSER_FONT_ASSETS.md) — WOFF2 build, sources, and validation

## Design records

Historical plans and specs kept for context. They describe the intent at the time of
writing, not necessarily the current implementation.

- [Auto-slice consistency design](./superpowers/specs/2026-04-21-auto-slice-consistency-design.md)
- [One-page comic — design](./superpowers/specs/2026-07-09-one-page-comic-design.md) · [plan](./superpowers/plans/2026-07-09-one-page-comic.md)
- [Chroma similarity unify — design](./superpowers/specs/2026-07-10-chroma-similarity-unify-design.md) · [plan](./superpowers/plans/2026-07-10-chroma-similarity-unify.md)
- [Canvas compose sticker layout design](./superpowers/specs/2026-07-11-canvas-compose-sticker-layout-design.md)
