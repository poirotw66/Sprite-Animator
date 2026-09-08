# Project Optimization Report

*Last audited: 2026-09-08. This report supersedes the 2026-07-12 first-round cleanup snapshot.*

## Current status

- CI covers security checks, generated LINE sticker SKILL mirrors, TypeScript strict mode, ESLint, Vitest, Python checks, and a production build.
- Route-level lazy loading is already in place.
- Chroma key removal runs in `workers/chromaKeyWorker.ts` through `utils/chromaKeyProcessor.ts`, with progress reporting and a main-thread fallback only when Workers are unavailable.
- `LineStickerPage.tsx` has been reduced from 866 to roughly 666 lines. Design, phrase, single-sheet, set-output, generation lifecycle, sheet-overview, and frame-edit responsibilities now have focused controllers.
- Playwright covers direct navigation plus offline upload → slice → selection → ZIP export flows on both Parting and LINE Sticker pages.
- Nine public LINE sticker CLI entry points share `--help`, repository-root path semantics, and distinct usage/runtime exit codes.
- Production builds use BYOK and do not inject Gemini keys; the local development fallback is limited to `vite dev`.

## Completed or no longer actionable

| Earlier finding | Current state |
|---|---|
| Add a Web Worker for chroma-key removal | Complete; worker and fallback share the core algorithm. |
| Add a background-removal progress indicator | Complete. |
| Split the LINE sticker controller surface | Complete baseline; lifecycle and domain state are separated while presentation remains in `components/LineSticker/`. |
| Add browser interaction coverage | Complete offline baseline for Parting and LINE Sticker; future Gemini flows should use network mocks. |
| Normalize public headless CLI behavior | Complete for the nine primary LINE sticker entry points. |
| Add a unit-test framework | Complete; the project uses Vitest and Python checks in CI. |
| Error-boundary loading strings | Complete; the relevant strings use i18n. |
| Expose a shared Gemini key through the browser build | Complete; production builds no longer inject a Gemini key. Rotate any key that was used by an older public build. |

## Remaining engineering priorities

### P0 — Release credential verification

Values embedded in a browser bundle are not secrets. Keep the current BYOK boundary in place, rotate any key previously used in a public build, and scan release artifacts with a synthetic sentinel before deployment. A future shared-key experience requires a protected server-side proxy with authentication, quota controls, and observability; a `VITE_*` environment variable is not secret storage.

### P1 — Asset delivery and bundle budget

The former figures for a `~667 KB` main bundle and `3` dynamic components are obsolete. The 2026-08-03 local production baseline is **63.58 MiB** for `dist`, including **13.26 MiB** of four browser WOFF2 fonts (no emitted TTF). The largest JavaScript asset is the demand-loaded `vendor-transformers` chunk at **568.19 kB raw / 164.85 kB gzip**. Its WASM resource is **23,567.05 kB raw / 5,757.04 kB gzip** and is likewise deferred until the AI removal flow needs it. These are deployment assets, not a first-route transfer total.

See [browser font assets](./BROWSER_FONT_ASSETS.md) for the reproducible font build and validation process.

Record a fresh `npm run build` baseline whenever those assets or code-splitting boundaries change; distinguish first-route assets from deferred resources.

Suggested guardrails:

- use WOFF2/subset fonts for browser delivery while preserving source fonts for tooling;
- defer Transformers/WASM until AI background removal is requested;
- set an explicit maximum chunk and asset-size budget in CI;
- measure representative browser flows, not only the build manifest.

### P2 — Extend browser and controller coverage

The offline interaction baseline is complete. Add mocked Gemini coverage only when
changing phrase import or generation states. Keep new lifecycle behavior in the
focused controllers and presentation in `components/LineSticker/`; avoid a broad
global store unless cross-route state actually requires it.

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
```

Run `npm run ci` before merging changes that touch build, scripts, skills, or release documentation.
