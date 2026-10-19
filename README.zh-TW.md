# Sprite Animator（角色幀動畫）

[English](./README.md) | [繁體中文](./README.zh-TW.md)

[![CI](https://github.com/poirotw66/Sprite-Animator/actions/workflows/ci.yml/badge.svg)](https://github.com/poirotw66/Sprite-Animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![線上 Demo](https://img.shields.io/badge/demo-bloss0m.com-e23d2f)](https://www.bloss0m.com/Sprite-Animator/)

**上傳一張角色圖，生成幀動畫與精靈圖——自動去背、網格切分，並匯出 APNG／GIF／ZIP。**

<p align="center">
  <img src="images/hero-demo.webp" alt="Sprite Animator 示範：由單張角色參考圖生成動畫" width="420" />
</p>

**線上 Demo：** [https://www.bloss0m.com/Sprite-Animator/](https://www.bloss0m.com/Sprite-Animator/)

## 快速開始

1. **安裝**
   ```bash
   npm ci
   ```
2. **（可選）本機金鑰** — 將 [`.env.example`](./.env.example) 複製為 `.env.local` 並設定 `GEMINI_API_KEY`（見下方 [API 金鑰](#api-金鑰)）。
3. **啟動**
   ```bash
   npm run dev
   ```
   開啟 [http://localhost:3000](http://localhost:3000) → **Sprite Animator**。

環境：Node.js 20–26（`>=20 <27`）、npm 10+（專案鎖定 10.9.2）。

## 核心功能

- **逐幀模式**：逐張生成，適合精細動作
- **精靈圖模式**：一次請求產出整張網格（較省 API 配額）
- **色鍵去背**（洋紅／綠幕）＋ Web Worker
- **網格切分**（padding／shift、即時預覽）
- **匯出** APNG、GIF、或 PNG 幀 ZIP

使用 Google Gemini 圖像 API（瀏覽器內自行填入 API Key）。

### 可選工作室工具

同一應用內另有共用切分／去背管線的**可選**工具，非核心動畫流程所必需：

| 工具 | 路由 | 說明 |
|------|------|------|
| LINE 貼圖製作 | `/#/line-sticker` | 短語、多張 sheet、IndexedDB 還原 |
| 一頁式漫畫 | `/#/one-page-comic` | 短篇漫畫嚮導 |
| 貼圖產出履歷 | `/#/daily-sticker-registry` | 批量生產登記 |
| 去背 | `/#/rmbg` | 獨立 AI／色鍵去背 |
| Parting | `/#/parting` | 既有精靈圖切分 |

Headless LINE 量產／上傳見 `skills/line-sticker-*`、`scripts/line-sticker/`；維護說明見 [AGENTS.md](./AGENTS.md)。

## API 金鑰

| 情境 | 作法 |
|------|------|
| **本機 `npm run dev`** | 可選：在 `.env.local` 設定 `GEMINI_API_KEY`（參考 [`.env.example`](./.env.example)）。僅注入 Vite 開發伺服器。 |
| **公開／正式站** | 在應用「設定」以 **BYOK** 自行輸入；存於該分頁的 `sessionStorage`。 |
| **Production 建置** | **不會**把 Gemini 金鑰寫進前端 bundle。CI 以假 sentinel 建置，若出現在 `dist/` 則失敗。 |

請使用自己的 Gemini API Key，並在 Google AI／Cloud 端設定配額與帳單上限。勿提交 `.env.local`，也勿把金鑰貼進 Issue 或 job 快照。

可選：Settings 中的 Hugging Face token 僅供按需載入的 AI 去背模型使用。

## 使用範例

同一張角色原圖（`images/gemini.webp`），不同動作提示：

| 動作 | 結果 |
|------|------|
| 開心 | ![開心](images/happy.webp) |
| 揮手 | ![揮手](images/wave.webp) |
| 偏頭疑惑 | ![偏頭疑惑](images/head-tilt.webp) |
| 生氣 | ![生氣](images/angry.webp) |

## 開發

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

完整品質門檻：`npm run ci`。貢獻說明見 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 授權

[MIT](./LICENSE) © 2026 poirotw66 / Justin

## 相關文件

- [切分與對齊流程](./docs/animation/SLICE_AND_ALIGN_FLOW.md)
- [去背說明](./docs/chroma/CHROMA_KEY.md)
- [背景顏色標準化](./docs/chroma/BACKGROUND_COLOR_NORMALIZATION.md)
- [文件索引](./docs/README.md)
