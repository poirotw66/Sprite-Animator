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
2. **（可選）本機 Gemini 金鑰** — 將 [`.env.example`](./.env.example) 複製為 `.env.local` 並設定 `GEMINI_API_KEY`（僅供 `npm run dev`；見 [API 金鑰](#api-金鑰)）。**沒有** OpenRouter 環境變數；OpenRouter 請在設定內貼上。
3. **啟動**
   ```bash
   npm run dev
   ```
   開啟 [http://localhost:3000](http://localhost:3000) — 預設進入 **Sprite Animator**（`/#/`；可選工作室工具在 `/#/studio`）。於 **設定** 選擇 **影像供應商**（`Google Gemini` 或 `OpenRouter（自備金鑰）`）並貼上對應金鑰。

環境：Node.js 20–26（`>=20 <27`）、npm 10+（專案鎖定 10.9.2）。

### Docker（僅網站）

建置並提供靜態 SPA（不含 LINE 工廠／Python 上傳工具）。映像**不會**內建 API 金鑰：

```bash
docker build -t sprite-animator .
docker run --rm -p 8080:8080 sprite-animator
```

開啟 [http://localhost:8080/](http://localhost:8080/)。請在應用 **設定** → **影像供應商** 以 BYOK 貼上 Gemini 或 OpenRouter 金鑰（存於 `sessionStorage`）。

## 核心功能

- **逐幀模式**：逐張生成，適合精細動作（**Gemini 或 OpenRouter**，由設定選擇）
- **精靈圖模式**：一次請求產出整張網格（較省 API 配額；**Gemini 或 OpenRouter**，由設定選擇）
- **色鍵去背**（洋紅／綠幕）＋ Web Worker
- **網格切分**（padding／shift、即時預覽）
- **匯出** APNG、GIF、ZIP（PNG 幀 + 打包圖集），以及 **Aseprite 相容 JSON**（json-array + `frameTags`，可供 Phaser `load.aseprite` 載入）

影像產生採瀏覽器 **BYOK**：可選 **Google Gemini** 或 **OpenRouter**（設定內切換）。金鑰僅存於目前分頁的 `sessionStorage`，不會打包進 bundle。

### 引擎匯出（ZIP／Aseprite）

下載 **ZIP** 會包含：

| 路徑 | 內容 |
|------|------|
| `frames/frame_XXX.png` | 個別幀 |
| `sprite-sheet.png` | 打包圖集（sheet 模式可用網格；否則水平條） |
| `sprite-sheet.json` | Aseprite `--format json-array` 中繼資料 |
| `manifest.json` | 精簡引擎清單：`cols`／`rows`、幀尺寸、`fps`、`frameCount`、`loop`、圖集路徑 |
| `animation.tres` | Godot 4 `SpriteFrames`（指向 `frames/*.png`） |

`manifest.json`（`schemaVersion: 1`）方便自訂載入器或快速檢視，不必解析完整 Aseprite JSON。

Phaser／Godot／**Unity Sprite Editor** 匯入說明見 [Engine export formats](./docs/animation/ENGINE_EXPORT.md)。

預覽工具列也可單獨下載 **Aseprite JSON**（與 ZIP 內圖集配對使用）。

**可執行範例**（內附精簡 sample export）：

| 路徑 | 引擎 |
|------|------|
| [`examples/phaser3/`](./examples/phaser3/) | Phaser 3 + `load.aseprite` |
| [`examples/godot4/`](./examples/godot4/) | Godot 4 + `animation.tres` |
| [`examples/sample-export/`](./examples/sample-export/) | 共用 ZIP 結構測試檔 |

```bash
# Phaser（需靜態伺服器）
npx --yes serve examples -p 4177
# → http://localhost:4177/phaser3/
```

以 Godot 4.2+ 開啟 `examples/godot4/` 後按 Play。

**Phaser 片段**（解壓 ZIP 後）：

```js
this.load.aseprite('hero', 'sprite-sheet.png', 'sprite-sheet.json');
this.anims.createFromAseprite('hero');
```

幀時長依目前播放 FPS（`speed × 3`）。

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
| **設定（BYOK）** | 齒輪 → **影像供應商**：`Google Gemini` 或 `OpenRouter（自備金鑰）`，再貼上對應金鑰。兩者皆存於目前分頁的 `sessionStorage`，關閉分頁即清除，不會打包進 bundle。 |
| **取得金鑰** | Gemini：[Google AI Studio](https://aistudio.google.com/app/apikey)。OpenRouter：[openrouter.ai/keys](https://openrouter.ai/keys)。 |
| **僅本機 `npm run dev`** | 可選：`.env.local` 的 `GEMINI_API_KEY`（參考 [`.env.example`](./.env.example)）在設定欄位空白時作為 Gemini 後備。**沒有** `OPENROUTER_*` 環境變數注入。 |
| **Docker／正式站** | 金鑰**不會**進映像或前端 bundle；一律用設定 BYOK。CI 以假 sentinel 建置，若真實金鑰出現在 `dist/` 則失敗。 |

**各功能對應的供應商**

| 功能 | 供應商 |
|------|--------|
| Sprite Animator **精靈圖**模式 | 設定所選供應商（`services/imageProviders/`） |
| Sprite Animator **逐幀**模式 | 設定所選供應商（`ImageProvider`）。Gemini 另做 AI 分鏡規劃；OpenRouter 使用演算法分鏡（Images API 無規劃端點）。建議選支援圖生圖的模型（例如 OpenRouter 的 `google/gemini-*-image`）。 |
| LINE 貼圖／一頁式漫畫 | **固定 Gemini**，即使 Sprite Animator 選了 OpenRouter |

請在供應商端設定配額與帳單上限。勿提交 `.env.local`，也勿把金鑰貼進 Issue 或 job 快照。

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
