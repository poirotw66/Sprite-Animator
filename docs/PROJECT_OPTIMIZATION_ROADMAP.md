# 專案優化路線圖

*最後校準：2026-09-08。此文件描述目前程式碼，而非早期 Sprite Animator 原型的待辦清單。*

## 目前基線

- 執行環境：Node.js 20 或 22（`>=20 <23`）、npm 10+。
- 核心工具：Sprite Animator、LINE 貼圖流程、單頁漫畫、AI 去背與每日貼圖登記。
- 品質門檻：`npm run ci` 會執行安全檢查、SKILL mirror 檢查、TypeScript、lint、Vitest、Python 檢查與 production build。
- 路由頁面已採 lazy loading；LINE 貼圖主流程已拆成設計、文案、單張、整組輸出、生成 lifecycle、sheet overview 與 frame edit controllers。
- Production build 採 BYOK，不注入 Gemini key；本機 `vite dev` 才可使用非公開的開發 fallback。

## 已完成（不應再列為待辦）

### Web Worker 去背與進度回饋

色鍵去背預設透過 `utils/chromaKeyProcessor.ts` 啟動
`workers/chromaKeyWorker.ts`，讓像素處理不佔用主 UI 執行緒；不支援 Worker 時才使用同一演算法的主執行緒 fallback。處理流程已有進度回呼。

因此，舊版文件中「去背阻塞主執行緒」、「建立 chroma key Worker」與「新增去背進度條」均已完成，不能再作為優先工作。

### 基礎工程品質

- TypeScript strict mode、ESLint 零 warning、Vitest 與 Python self-check 已納入 CI。
- Error boundary 與主要 loading/error 字串已接上 i18n。
- 精靈圖切分、色鍵修復、LINE 格式與文案格式已有單元測試。
- `LineStickerPage` 已從 866 行降至約 666 行；可編輯狀態、輸出 lifecycle、生成／重置、sheet overview 與 frame edit 已移至專責 controllers。
- Playwright 已覆蓋所有主要路由，以及 Parting 與 LINE Sticker 的本地「上傳 → 切片 → 選取 → ZIP」流程，不需要 Gemini。
- 九個主要 headless LINE CLI 已有共同的 `--help`、repo-root 路徑、usage exit code 2 與 runtime exit code 1 契約。
- GitHub Actions 的 quality gate 與 deploy 已採最小權限分離；舊版曾注入公開 build 的 Gemini key 應視為可能暴露並輪替。

## 優先工作

| 優先級 | 工作 | 完成條件 |
|---|---|---|
| P0 | 舊 Gemini key 輪替與 release 驗證 | 輪替曾用於公開 build 的 key；每次 release 確認 production bundle 不含 key sentinel。 |
| P1 | 靜態資產與 AI runtime 載入策略 | 字型採 WOFF2／subset，Transformers/WASM 在需要時才載入，並設定可追蹤的 bundle budget。 |
| P2 | Browser-level AI 流程測試 | 現有離線上傳／切片／ZIP 已涵蓋；下一階段以 mock Gemini 覆蓋 phrase import 與生成狀態。 |
| P2 | LINE 貼圖 controller 維護 | controller 基線已完成；新增功能不得把 lifecycle 或 ViewModel mapping 搬回頁面。 |
| P2 | 文件與 SKILL 路由 | 補齊根目錄 `AGENTS.md`，說明 canonical `skills/`、mirror 同步、必要 CI 與敏感設定處理。 |

## 效能量測原則

舊版的「主包 ~667 KB、三個動態元件 ~14 KB」是早期快照，已不具可比性；不得再把它作為目前基線。每次影響資產或 code splitting 的變更，應執行：

```bash
npm run build
```

2026-08-03 本機 production build 基線：`dist` 合計 **63.58 MiB**；瀏覽器字型為 **13.26 MiB**（4 個 WOFF2、無 TTF）；最大的 JavaScript chunk 為 demand-loaded `vendor-transformers`，**568.19 kB raw / 164.85 kB gzip**。Transformers WASM 為 **23,567.05 kB raw / 5,757.04 kB gzip**，同樣僅在 AI 去背流程需要時載入。這些數字不可視為首屏傳輸量。

字型來源、產物與重建方式見 [瀏覽器字型資產說明](./BROWSER_FONT_ASSETS.md)。

並在 PR／報告記錄：

1. 最大 JavaScript chunk 的 gzip 與原始大小。
2. 首次路由所需資產，以及延遲載入的字型、WASM、AI runtime 的大小。
3. 可重現的測量日期、Node/npm 版本與 build command。

不要將可選 AI 模型、延遲字型或所有靜態檔加總後，誤標為「首屏 bundle」。Core Web Vitals 應以實際部署環境與代表性圖片流程量測。

## 驗收清單

- [ ] 公開網站沒有可重複使用的 Gemini 服務端金鑰。
- [ ] 重要資產有明確 lazy-load 邊界與大小預算。
- [x] 主要離線互動流程有 browser smoke/E2E coverage。
- [x] `LineStickerPage` 的狀態與生成 lifecycle 已拆成專責 controllers。
- [x] 文件、SKILL canonical source 與 generated mirrors 一致。

## 參考

- [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [React: Render and Commit](https://react.dev/learn/render-and-commit)
