# Project Optimization Report

*Last audited: 2026-09-09. This report supersedes the 2026-07-12 first-round cleanup snapshot.*

## Current status

- CI covers security checks, generated LINE sticker SKILL mirrors, TypeScript strict mode, ESLint, Vitest, Python checks, a production build, credential bundle scan, and `dist:budget`.
- Route-level lazy loading is already in place.
- Chroma key removal runs in `workers/chromaKeyWorker.ts` through `utils/chromaKeyProcessor.ts`, with progress reporting and a main-thread fallback only when Workers are unavailable.
- `LineStickerPage.tsx` remains a thin shell; design, phrase, single-sheet, set-output, generation lifecycle, sheet-overview, frame-edit, and IndexedDB resume responsibilities live in focused hooks/controllers.
- Playwright covers direct navigation, offline upload → slice → selection → ZIP export, and mocked Gemini phrase/generate flows on the LINE Sticker page.
- Nine public LINE sticker CLI entry points share `--help`, repository-root path semantics, and distinct usage/runtime exit codes.
- Production builds use BYOK and do not inject Gemini keys; the local development fallback is limited to `vite dev`.
- Style-preview PNG sources live under `assets/` (not Vite `publicDir`); runtime ships WebP thumbnails only.

## Completed or no longer actionable

| Earlier finding | Current state |
|---|---|
| Add a Web Worker for chroma-key removal | Complete; worker and fallback share the core algorithm. |
| Add a background-removal progress indicator | Complete. |
| Split the LINE sticker controller surface | Complete baseline; lifecycle and domain state are separated while presentation remains in `components/LineSticker/`. |
| Add browser interaction coverage | Complete offline baseline plus mocked Gemini phrase/generate coverage. |
| Normalize public headless CLI behavior | Complete for the nine primary LINE sticker entry points. |
| Add a unit-test framework | Complete; the project uses Vitest and Python checks in CI. |
| Error-boundary loading strings | Complete; the relevant strings use i18n. |
| Expose a shared Gemini key through the browser build | Complete; production builds no longer inject a Gemini key. Ops checklist: [CREDENTIAL_ROTATION_CHECKLIST.md](./CREDENTIAL_ROTATION_CHECKLIST.md). |
| Stop shipping preview PNG sources in `dist` | Complete; sources moved to `assets/`; CI `dist:budget` enforces the invariant. |
| Persist LINE sticker jobs across refresh | Complete IndexedDB resume with hydrating/restored/interrupted UX. |

## Remaining engineering priorities

### P0 — Release credential verification

Values embedded in a browser bundle are not secrets. Keep the current BYOK boundary in place, rotate any key previously used in a public build, and scan release artifacts with a synthetic sentinel before deployment. Follow [CREDENTIAL_ROTATION_CHECKLIST.md](./CREDENTIAL_ROTATION_CHECKLIST.md). A future shared-key experience requires a protected server-side proxy with authentication, quota controls, and observability; a `VITE_*` environment variable is not secret storage.

### P1 — Asset delivery and bundle budget

The former figures for a `~667 KB` main bundle and `3` dynamic components are obsolete. The **2026-09-09** local production baseline is about **26 MiB** for `dist` (WASM-dominated ~23 MiB deferred Transformers runtime). Runtime style previews are ~1.0 MiB of WebP thumbnails plus `font.webp`; build-only PNG sources are no longer copied into `dist`. The largest JavaScript asset remains the demand-loaded `vendor-transformers` chunk (~568 kB raw / ~164 kB gzip).

See [browser font assets](./BROWSER_FONT_ASSETS.md) for the reproducible font build and validation process.

Record a fresh `npm run build` baseline whenever those assets or code-splitting boundaries change; distinguish first-route assets from deferred resources. Enforce with `npm run dist:budget` (also wired into CI).

Suggested guardrails:

- keep preview/font PNG sources outside `public/`;
- defer Transformers/WASM until AI background removal is requested;
- keep the explicit `dist:budget` gate green;
- measure representative browser flows, not only the build manifest.

### P2 — Extend browser and controller coverage

Offline and mocked-Gemini baselines exist. Prefer extending those mocks when changing phrase import or generation states. Keep new lifecycle behavior in the focused controllers and presentation in `components/LineSticker/`; avoid a broad global store unless cross-route state actually requires it.

### P2 — Type hygiene and observability

- Replace remaining loose Transformers integration types in `utils/aiBackgroundRemoval.ts` where upstream types permit it.
- Prefer `logger` for new application logs.
- Capture reproducible bundle and browser performance measurements before tuning for a fixed number.

## Verification checklist for a change

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run dist:budget
```

Run `npm run ci` before merging changes that touch build, scripts, skills, or release documentation.
