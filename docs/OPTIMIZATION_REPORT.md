# Project Optimization Report

Summary of findings and recommended improvements across the codebase.

---

## 1. TypeScript & Code Quality

### 1.1 Reduce `any` usage

| File | Location | Suggestion |
|------|----------|------------|
| `LineStickerPage.tsx` | `err: any` in catch blocks | Use `unknown` and type guard: `err instanceof Error ? err.message : String(err)` |
| `LineStickerPage.tsx` | `e.target.value as any` for preset keys | Use proper types: `keyof typeof STYLE_PRESETS` etc. and validate option value before setState |
| `RemoveBackgroundPage.tsx` | `err: any` | Same as above |
| `useLineStickerGeneration.ts` | `err: any` | Same as above |
| `aiBackgroundRemoval.ts` | `(env as any)`, `segmenter: any`, `config: any` | Use `@huggingface/transformers` env types if available; type segmenter from pipeline return type |

### 1.2 Dead code

- **`utils/chromaKeyProcessor.ts`**: `isGreenScreenHSL` and `isMagentaScreenHSL` are defined but never used (chroma key runs in worker). Safe to remove to reduce bundle and confusion.

---

## 2. Error handling

- **Catch clauses**: Prefer `catch (err: unknown)` and then `const message = err instanceof Error ? err.message : String(err);` for user-facing messages. Avoid `err.message` on `any`.
- **ErrorBoundary**: Uses raw `console.error` — acceptable for critical errors. Consider using `logger.error` for consistency so it can be toggled or sent to a service later.

---

## 3. i18n & Accessibility

- **ErrorBoundary.tsx**: All UI text is hardcoded in Chinese (e.g. "發生錯誤", "重試", "重新載入頁面"). Prefer moving to i18n (e.g. `useLanguage()` or a context passed to the fallback) so the error UI respects app language.
- **PageLoader in App.tsx**: "Loading..." is hardcoded; could use i18n.

---

## 4. Build & Environment

- **vite.config.ts** `define`: Uses `env.GEMINI_API_KEY` from `loadEnv`. Vite only exposes `VITE_*` to the client; if `.env` uses `VITE_GEMINI_API_KEY`, build won’t see it unless you read that key. Recommend:  
  `JSON.stringify(env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '')`  
  so both variable names work in dev and build.

---

## 5. Performance & Structure

- **LineStickerPage.tsx**: Large (~990 lines). Consider splitting into:
  - `LineStickerPhraseGrid`, `LineStickerPreview`, `LineStickerDownloadBar` and/or
  - A sub-hook for phrase/sheet state (e.g. `useLineStickerSetState`)  
  to improve readability and reuse.
- **Lazy loading**: App already lazy-loads pages; FrameGrid and SpriteSheetViewer are lazy in LineStickerPage. No urgent change.
- **Manual chunks (vite)**: `vendor-react`, `vendor-genai`, `vendor-ui` are already set; consider adding `jszip` to a chunk if LINE download bundle is large.

---

## 6. Logging

- **aiBackgroundRemoval.ts**: Uses raw `console.log` for the boot banner. Consider `logger.info` or a one-off banner helper so production can suppress it if needed.
- **logger.ts**: Implementation is fine; used in several places. Keep using it for new code.

---

## 7. Security & Best practices

- API keys and HF token are read from localStorage / env and passed via hooks; not hardcoded. Good.
- No obvious secrets in repo; keep using env and storage.

---

## 8. Suggested priority

| Priority | Item | Effort |
|----------|------|--------|
| High | Remove dead `isGreenScreenHSL` / `isMagentaScreenHSL` from chromaKeyProcessor | Low |
| High | Fix vite define to support both VITE_GEMINI_API_KEY and GEMINI_API_KEY | Low |
| Medium | Replace catch `err: any` with `unknown` + type guard in 3–4 files | Low |
| Medium | ErrorBoundary i18n and/or logger | Medium |
| Low | Split LineStickerPage into smaller components | Medium |
| Low | Tighten preset select types (LineStickerPage) | Low |

---

*Generated as a one-time audit; implement items as needed per sprint.*
