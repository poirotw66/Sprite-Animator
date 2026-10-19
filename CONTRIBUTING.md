# Contributing

Thanks for your interest in Sprite Animator.

## Setup

```bash
npm ci
npm test
```

Optional local Gemini key: copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` (dev-server Gemini fallback only). For UI work, open Settings → **Image provider** (`Google Gemini` or `OpenRouter (BYOK)`) and paste the matching key; keys stay in `sessionStorage` and are never committed. There is no OpenRouter env var.

Useful checks before opening a PR:

```bash
npm run typecheck
npm run lint
npm run test
```

If you touch browser routes or offline flows, also run `npm run test:e2e` (install Chromium once with `npx playwright install chromium`). Full gate: `npm run ci`.

## Scope

**Welcome**

- Sprite Animator UX and generation quality
- Slicing, chroma key, and export (APNG / GIF / ZIP and future engine metadata)
- Docs, i18n, tests, and CI hygiene for the core product

**Not a priority right now**

- LINE sticker headless factory (`scripts/line-sticker/`, upload automation, skills mass-production)
- Expanding Comic / Registry unless it clearly helps the shared sprite pipeline

Please keep PRs focused. Do not commit secrets, `.env.local`, `.line-upload/`, or `.secrets/`.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
