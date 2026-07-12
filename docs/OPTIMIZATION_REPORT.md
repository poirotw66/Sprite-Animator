# Project Optimization Report

Summary of findings and recommended improvements across the codebase.

*Last updated: 2026-07-12 — reflects first-round dead-code cleanup and CI/typecheck fixes.*

---

## 1. TypeScript & Code Quality

### 1.1 Reduce `any` usage

| File | Location | Suggestion |
|------|----------|------------|
| `LineStickerPage.tsx` | preset select `as any` (if any remain) | Use `keyof typeof STYLE_PRESETS` and validate option value before setState |
| `aiBackgroundRemoval.ts` | `(env as any)`, `segmenter: any`, `config: any` | Use `@huggingface/transformers` env types if available |

**Done (2026-07-12):** `catch (err: unknown)` in `LineStickerPage`, `RemoveBackgroundPage`, `SpriteAnimatorPage` export paths.

### 1.2 Dead code

**Done (2026-07-12):**

- Removed `utils/loadBundledImage.ts`, unused `reference/comic/model-sheet-layout.png`
- Removed `cleanBase64`, `removeChromaKey`, `removeWhiteBackground` from `utils/imageUtils.ts`
- Removed unused `CHROMA_KEY_COLOR`, `IMAGE_RESOLUTION_OPTIONS`, `ENABLE_FRAME_INTERPOLATION` from `utils/constants.ts`
- Removed unused `autoprefixer` devDependency

**Done (2026-07-12):** removed legacy/debug/diagnose CLI entrypoints:

- `rebuild-line-upload.mts`
- `compare-chroma-forge.mts`
- `debug-sticker-pipeline.mts`
- `preview-programmatic-font-sizes.mts`
- `audit-programmatic-overlay.mts`
- `reslice-core-preview.mts`
- `scripts/diagnose-sheet-slice.mts`

**Still optional:** none for graphify gitignore (added 2026-07-12).

### 1.3 Typecheck / CI

**Done (2026-07-12):**

- `utils/lineStickerCompose.ts`: narrow `ComposeCanvas2D` interface for `@napi-rs/canvas`
- `vite.config.ts`: `Plugin` return type for dev middleware (fixes `pipe(res)` typing)

---

## 2. Error handling

- **Catch clauses**: Prefer `catch (err: unknown)` and `getErrorMessage` / `err instanceof Error` for user-facing messages.
- **ErrorBoundary**: **Done** — UI strings moved to i18n (`errorBoundary*` keys); reads language from `localStorage`.

---

## 3. i18n & Accessibility

**Done (2026-07-12):**

- `ErrorBoundary.tsx` — i18n via `getTranslation` + stored language
- `App.tsx` `PageLoader` — `t.pageLoading`

---

## 4. Build & Environment

**Done (2026-07-12):** `vite.config.ts` `define` uses `env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? ''`.

---

## 5. Performance & Structure

- **LineStickerPage.tsx**: Large (~990 lines). Consider splitting into sub-components or `useLineStickerSetState` hook.
- **Lazy loading**: App already lazy-loads pages. No urgent change.
- **Manual chunks**: Consider `jszip` in its own chunk if LINE download bundle is large.

---

## 6. Logging

- **aiBackgroundRemoval.ts**: Boot banner still uses `console.log`; optional `logger.info`.
- **logger.ts**: Keep using for new code.

---

## 7. Security & Best practices

- API keys read from localStorage / env; not hardcoded. Good.

---

## 8. Suggested priority (remaining)

| Priority | Item | Effort |
|----------|------|--------|
| Medium | Tighten preset select types (LineStickerPage) | Low |
| Low | Split LineStickerPage into smaller components | Medium |
| Low | daily-pack backfill theme/voice + `--replan` | Medium |

---

*Generated as a living audit; implement items as needed per sprint.*
