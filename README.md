# Sprite Animator

[English](./README.md) | [繁體中文](./README.zh-TW.md)

[![CI](https://github.com/poirotw66/Sprite-Animator/actions/workflows/ci.yml/badge.svg)](https://github.com/poirotw66/Sprite-Animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-bloss0m.com-e23d2f)](https://www.bloss0m.com/Sprite-Animator/)

**Turn a character image into frame animations and sprite sheets — with auto background removal, grid slicing, and APNG / GIF / ZIP export.**

<p align="center">
  <img src="images/hero-demo.webp" alt="Sprite Animator demo: character animation generated from a single reference image" width="420" />
</p>

**Live demo:** [https://www.bloss0m.com/Sprite-Animator/](https://www.bloss0m.com/Sprite-Animator/)

## Quick start

1. **Install**
   ```bash
   npm ci
   ```
2. **Optional local Gemini key** — copy [`.env.example`](./.env.example) to `.env.local` and set `GEMINI_API_KEY` for `npm run dev` only (see [API keys](#api-keys)). There is no OpenRouter env var; use Settings for OpenRouter.
3. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) — the app opens **Sprite Animator** at `/#/` (optional studio tools live at `/#/studio`). In **Settings**, choose **Image provider** (`Google Gemini` or `OpenRouter (BYOK)`) and paste the matching key.

Requirements: Node.js 20–26 (`>=20 <27`), npm 10+ (pinned to 10.9.2).

### Docker (web app only)

Builds and serves the static SPA (no LINE factory / Python upload tools). The image does **not** bake in API keys:

```bash
docker build -t sprite-animator .
docker run --rm -p 8080:8080 sprite-animator
```

Open [http://localhost:8080/](http://localhost:8080/). Use in-app **Settings** → **Image provider** and paste a Gemini or OpenRouter key (BYOK / `sessionStorage`).

## What it does

Upload one character image, describe an action (e.g. “Run Cycle”), and generate:

- **Frame-by-frame mode** — one API call per frame for finer motion control (**Gemini or OpenRouter** via Settings)  
- **Sprite sheet mode** — one API call for a full grid (quota-friendly; **Gemini or OpenRouter** via Settings)  
- **Chroma-key background removal** (magenta / green) with Web Worker processing  
- **Grid slicing** with padding, shift, and live preview  
- **Export** APNG, GIF, ZIP (PNG frames + packed atlas), and **Aseprite-compatible JSON** (json-array + `frameTags`, Phaser `load.aseprite`-ready)

Bring-your-own-key image generation: **Google Gemini** or **OpenRouter** (selectable in Settings). Keys stay in the browser tab (`sessionStorage`) and are never bundled.

### Engine export (ZIP / Aseprite)

Downloading **ZIP** produces:

| Path | Contents |
|------|----------|
| `frames/frame_XXX.png` | Individual frames |
| `sprite-sheet.png` | Packed atlas (grid when sheet mode fits; otherwise a horizontal strip) |
| `sprite-sheet.json` | Aseprite `--format json-array` metadata (`frames[]`, `meta.image`, `meta.frameTags`) |
| `manifest.json` | Compact engine manifest: `cols` / `rows`, frame size, `fps`, `frameCount`, `loop`, sheet paths |
| `animation.tres` | Godot 4 `SpriteFrames` pointing at `frames/*.png` |

`manifest.json` schema (`schemaVersion: 1`) is meant for custom loaders and quick inspection without parsing Aseprite JSON.

See [Engine export formats](./docs/animation/ENGINE_EXPORT.md) for Phaser / Godot / **Unity Sprite Editor** import notes.

You can also download **Aseprite JSON** alone from the preview toolbar (pairs with the atlas inside the ZIP).

**Runnable examples** (tiny sample export included):

| Path | Engine |
|------|--------|
| [`examples/phaser3/`](./examples/phaser3/) | Phaser 3 + `load.aseprite` |
| [`examples/godot4/`](./examples/godot4/) | Godot 4 + `animation.tres` |
| [`examples/sample-export/`](./examples/sample-export/) | Shared ZIP-shaped fixture |

```bash
# Phaser (static server required)
npx --yes serve examples -p 4177
# → http://localhost:4177/phaser3/
```

Open `examples/godot4/` in Godot 4.2+ and press Play.

**Phaser snippet** (after unpacking a ZIP):

```js
this.load.aseprite('hero', 'sprite-sheet.png', 'sprite-sheet.json');
// later:
this.anims.createFromAseprite('hero');
```

Frame durations follow the current playback FPS (`speed × 3` ms per frame).

### Optional studio tools

The same app also includes **optional** tools that share the sprite pipeline. They are not required for the core animator:

| Tool | Route | Notes |
|------|-------|--------|
| LINE Sticker Maker | `/#/line-sticker` | Phrases, sheets, IndexedDB resume |
| One-Page Comic | `/#/one-page-comic` | Short comic wizard |
| Daily Sticker Registry | `/#/daily-sticker-registry` | Batch production dashboard |
| Remove Background | `/#/rmbg` | Standalone AI / chroma removal |
| Parting | `/#/parting` | Slice an existing sprite sheet |

Headless LINE mass-production / upload lives under `skills/line-sticker-*` and `scripts/line-sticker/` for maintainers; see [AGENTS.md](./AGENTS.md).

## API keys

| Context | How |
|---------|-----|
| **Settings (BYOK)** | Gear → **Image provider**: `Google Gemini` or `OpenRouter (BYOK)`. Paste the matching key. Both keys are stored in `sessionStorage` for the current tab only and cleared when the tab closes. Never bundled. |
| **Get a key** | Gemini: [Google AI Studio](https://aistudio.google.com/app/apikey). OpenRouter: [openrouter.ai/keys](https://openrouter.ai/keys). |
| **Local `npm run dev` only** | Optional `GEMINI_API_KEY` in `.env.local` (from [`.env.example`](./.env.example)) fills Gemini when the Settings field is empty. **No** `OPENROUTER_*` env injection exists. |
| **Docker / production** | Keys are **never** in the image or client bundle. Always use Settings BYOK. CI builds with a fake sentinel and fails if a real key appears in `dist/`. |

**What each provider covers**

| Surface | Provider |
|---------|----------|
| Sprite Animator **sheet** mode | Selected provider (`services/imageProviders/`) |
| Sprite Animator **frame-by-frame** mode | Selected provider (`ImageProvider`). Gemini also runs AI storyboard planning; OpenRouter uses an algorithmic storyboard (Images API has no planning endpoint). Prefer image-to-image capable models (e.g. `google/gemini-*-image` on OpenRouter). |
| LINE Sticker / One-Page Comic | **Gemini-only**, even if OpenRouter is selected for Sprite Animator |

Do not commit `.env.local` or paste keys into issues or job snapshots. Set quotas / billing limits on the provider side.

Optional: a Hugging Face token in Settings is only for on-demand AI background removal (`@huggingface/transformers`).

## Demo gallery

Same source character (`images/gemini.webp`), different action prompts:

| Action | Result |
|--------|--------|
| Happy | ![Happy](images/happy.webp) |
| Wave | ![Wave](images/wave.webp) |
| Head tilt | ![Head tilt](images/head-tilt.webp) |
| Angry | ![Angry](images/angry.webp) |

## Project layout (excerpt)

```
Sprite-Animator/
├── pages/SpriteAnimatorPage.tsx   # Core product
├── services/imageProviders/       # Gemini + OpenRouter BYOK (sheet + frame generation)
├── services/gemini/               # Prompts, storyboard helpers, optional LINE/comic
├── hooks/                         # Sprite flow, export, animation…
├── utils/                         # Chroma key, slicing, constants
├── workers/                       # Chroma Web Worker
├── components/                    # Shared UI + optional tool UIs
├── features/line-sticker/         # Optional LINE domain / IndexedDB
├── scripts/line-sticker/          # Optional headless factory (maintainers)
├── skills/                        # Optional agent skills (canonical source)
└── i18n/                          # en + zh-TW UI copy
```

## Development

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e          # Playwright (needs Chromium once)
npm run build
npm run dist:budget       # after build
```

Full quality gate (includes Python LINE tooling): `npm run ci`.

### Installed skill maintenance

`skills/` is canonical. Project mirrors are refreshed with
`npm run skills:sync:line-sticker`; optional global copies under
`$CODEX_HOME/skills` (default `~/.codex/skills`) are inspected separately:

```bash
# Read-only: report fingerprints and changed files for matching installed skills.
npx tsx scripts/line-sticker/manage-installed-skills.mts
npx tsx scripts/line-sticker/manage-installed-skills.mts --skill huahua-line-sticker-series

# After reviewing the differences, update exactly that installed copy.
npx tsx scripts/line-sticker/manage-installed-skills.mts \
  --skill huahua-line-sticker-series --update \
  --expect-installed <installed-sha256-from-inspection>
```

Missing optional global copies are reported without failing an all-skills check;
an explicitly selected missing copy or detected drift exits with status 1.
Updates require an existing installation and its inspected fingerprint, replace
only the selected package, and preserve the old directory in sibling
`skill-backups/` outside skill discovery. A changed fingerprint aborts the update.
A package symlink resolving to that exact canonical package is reported as
`linked`; it already reads the source and is never replaced. Other symlinks,
overlapping roots, credentials and session artifacts are refused.
Use `--installed-root /absolute/path/to/skills` to inspect a different installation;
this tool does not refresh project mirrors or install missing skills.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

### Deploy (GitHub Pages)

Push to `main` runs CI and deploys Pages when green. Enable **Settings → Pages → Source: GitHub Actions**. Live site: [bloss0m.com/Sprite-Animator](https://www.bloss0m.com/Sprite-Animator/).

## Tech stack

React 19 · Vite 6 · TypeScript · Tailwind CSS 4 · React Router 7 · Google Gemini (`@google/genai`) · OpenRouter Images API (BYOK) · upng-js · gifenc · jszip · optional `@huggingface/transformers` · Python/uv for optional LINE upload tooling

## License

[MIT](./LICENSE) © 2026 poirotw66 / Justin

## Contributing

Sprite Animator and export improvements are especially welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Docs

- [Slice & align flow](./docs/animation/SLICE_AND_ALIGN_FLOW.md)
- [Chroma key](./docs/chroma/CHROMA_KEY.md)
- [Background color normalization](./docs/chroma/BACKGROUND_COLOR_NORMALIZATION.md)
- [Docs index](./docs/README.md)
