# 角色幀動畫與貼圖工作室（Sprite Animator + LINE 貼圖 + Comic）
[English](./README_en.md) | [繁體中文](./README.md)

> 本專案最初為「角色幀動畫生成器」，現已擴充為多工具工作室：  
> - Sprite Animator（逐幀 / 精靈圖）  
> - LINE 貼圖製作（含文案、版面、IndexedDB 還原、自動上傳的 headless 工廠）  
> - One-Page Comic（單頁漫畫嚮導）  
> - Remove Background（AI 去背）  
> - Daily Sticker Registry（批量生產登記盤點）  
> - Parting（精靈圖分割）

## ✨ 功能特色

- 🎨 **兩種生成模式**：
  - **逐幀模式**：逐個生成動畫幀，適合複雜動作
  - **精靈圖模式**：一次生成完整精靈圖，節省 API 配額（僅需 1 次請求）

- 🖼️ **靈活的精靈圖處理**：
  - 可調整網格切分（Cols/Rows）
  - 支持 Padding（縮放）和 Shift（位移）調整
  - **自動精確去背**：類似 ImageMagick 的色度去背（支援洋紅色 #FF00FF 和綠幕 #00FF00）
  - **智能顏色標準化**：自動修正 AI 生成的色差,確保完美去背
  - 實時預覽網格切分效果
  - **工業級切分**：整數座標、邊界檢查、像素完美對齊

- 📤 **多種導出格式**：
  - APNG（高清，支持透明）
  - GIF（兼容性好）
  - ZIP（所有幀的原始 PNG 文件）

- 💬 **LINE 貼圖工作區**：
  - 瀏覽器內完成角色上傳、文案、生成、切片與下載
  - **IndexedDB 作業還原**：重新整理後可接續上一份貼圖作業（影像／文案以 job SoT 持久化）
  - 損壞的本機紀錄不會拖垮作業列表；刪除作業會一併清除資產
  - 中斷中的生成會在還原時標示為已取消，並顯示可關閉提示

- 🎛️ **Signal Studio 介面語言**：
  - 全站統一的冷紙面 + vermillion 強調色（不再依工具彩虹配色）
  - Outfit + Noto Sans TC 字體、共用 header／按鈕／banner 樣式
  - 各工具頁維持相同 chrome，降低切換成本

- ⚡ **性能優化**：
  - React 性能優化（useMemo, useCallback, React.memo）
  - 代碼分割（動態導入）
  - 使用 requestAnimationFrame 實現流暢動畫
  - **Web Worker 去背處理**：後台處理，不阻塞 UI
  - **進度指示器**：實時顯示處理進度

- 🛡️ **穩定性**：
  - 完整的 TypeScript 類型支持
  - 錯誤邊界（Error Boundary）
  - 統一的錯誤處理
  - 自動重試機制（帶指數退避）
  - 生產環境日誌管理（開發/生產環境自動切換）
  - CI 含 typecheck、lint、單元／e2e、Python 檢查、dist budget 與秘密掃描

## 🚀 快速開始

### 環境要求

- Node.js 20–26（`>=20 <27`）
- npm 10+（建議使用專案鎖定的 npm 10.9.2）

### 安裝步驟

1. **克隆或下載專案**

2. **安裝依賴**：
   ```bash
   npm install
   ```

3. **設定本機開發金鑰**（可選）：
   若以 `npm run dev` 在本機開發，可建立 `.env.local`：
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   公開部署不會內嵌這個金鑰；請在應用設定中輸入自己的 API Key。

4. **啟動開發服務器**：
   ```bash
   npm run dev
   ```

5. **打開瀏覽器**：
   訪問 `http://localhost:3000`

## 📖 使用指南

### 基本流程（Sprite Animator）

1. **上傳角色圖片**：點擊或拖拽上傳角色圖片
2. **選擇模式**：
   - **逐幀模式**：適合需要精細控制的動畫
   - **精靈圖模式**：快速生成，節省 API 配額
3. **輸入動作提示詞**：例如 "Run Cycle"、"Jump"、"Sword Attack"
4. **調整參數**：
   - 幀數（逐幀模式）或網格大小（精靈圖模式）
   - 播放速度
   - 預覽縮放
5. **生成動畫**：點擊生成按鈕
6. **導出結果**：選擇 APNG、GIF 或 ZIP 格式

### LINE 貼圖（`/#/line-sticker`）

1. 上傳角色參考圖並填寫／生成貼圖文案
2. 產生套圖（多張 sheet）並切片、去背、下載
3. 重新整理頁面後，系統會嘗試還原上一份作業；若作業遺失或損毀，會顯示提示並從空白開始
4. 進階 headless 量產／上傳請見 `.claude/skills/line-sticker-*` 與 `scripts/line-sticker/`

### 精靈圖模式進階功能

- **網格切分設定**：調整 Cols 和 Rows 來匹配生成的精靈圖
- **Padding（縮放）**：減少有效區域大小，去除邊緣
- **Shift（位移）**：微調切分位置（支持負數，自動調整到有效範圍）
- **自動精確去背**：
  - 自動檢測背景顏色（採樣四個角落）
  - 使用類似 ImageMagick 的算法（`-fuzz 2% -transparent "#FF00FF"`）
  - Web Worker 後台處理，不阻塞 UI
  - 實時進度顯示（0-100%）
  - 確保無白邊、無棋盤格、無框限錯覺

## 📷 使用範例

以下以同一張角色原圖，搭配不同動作提示詞，生成多段動畫並導出為 GIF。

### 原圖（輸入）

上傳一張角色立繪或半身圖作為生成來源：

| 原圖 |
|------|
| <img src="images/gemini.webp" alt="原圖 gemini" width="300"> |
| **gemini.webp** — 角色原檔 |

### 生成結果（輸出）

使用本工具選擇**精靈圖模式**或**逐幀模式**，輸入動作提示詞後生成動畫，再導出為 GIF：

| 動作 | 生成 GIF |
|------|----------|
| 開心 | ![開心](images/開心.webp) |
| 揮手 | ![揮手](images/揮手.webp) |
| 偏頭疑惑 | ![偏頭疑惑](images/偏頭疑惑.webp) |
| 生氣 | ![生氣](images/生氣.webp) |

以上 GIF 皆由 **gemini.webp** 作為原圖，經本工具搭配 Google Gemini API 生成幀動畫後導出。

## 🏗️ 專案結構（節錄）

```
Sprite-Animator/
├── components/          # React 組件
│   ├── ui/              # Signal Studio 共用 chrome（如 ToolPageHeader）
│   ├── LineSticker/     # LINE 貼圖瀏覽器 UI
│   ├── Comic/           # 單頁漫畫嚮導
│   ├── SettingsModal.tsx
│   ├── ImageUpload.tsx
│   ├── AnimationConfig.tsx
│   ├── SpriteSheetViewer.tsx
│   ├── AnimationPreview.tsx
│   └── ...
├── features/
│   └── line-sticker/    # LINE 貼圖 domain／persistence（IndexedDB）
├── hooks/               # 自定義 Hooks（含 job 還原、影像／文案 SoT）
├── pages/               # 各工具頁面（HashRouter）
├── services/            # API 服務
├── utils/               # 工具函數（切片、去背、常數等）
├── workers/             # Web Workers
├── i18n/                # 繁中／英文文案
├── scripts/             # CI、字體／縮圖、LINE headless 工具
├── App.tsx
├── index.tsx
├── index.css            # Tailwind v4 + Signal Studio tokens
└── vite.config.ts
```

更多功能頁面：
- `/#/sprite-animation`：角色幀動畫／精靈圖
- `/#/line-sticker`：瀏覽器內完成一整套 LINE 貼圖（含作業還原）
- `/#/daily-sticker-registry`：批量生產使用的登記與盤點
- `/#/one-page-comic`：單頁漫畫嚮導
- `/#/rmbg`：背景去除
- `/#/parting`：精靈圖分割工具

頁面採 hash routing，確保 GitHub Pages 上直接開啟或重新整理子頁面不會得到 404。

## 🔧 開發

首次 clone 請執行 `graphify update .` 建立本地程式碼知識圖（產出至 `graphify-out/`，約 15 秒，不進版控）。

修改 `assets/style-preview-sources/*.png` 或 `assets/font.png` 後，請重建並提交瀏覽器縮圖：

```bash
npm run previews:build
npm run previews:check
```

常用檢查：

```bash
npm run typecheck
npm run lint
npm run test
npm run dist:budget   # 建置後資產體積門檻
```

### 構建生產版本

```bash
npm run build
```

### 預覽生產版本

```bash
npm run preview
```

## 🚀 部署到 GitHub Pages

### 自動部署（推薦）

專案已配置 GitHub Actions 自動部署工作流。只需：

1. **啟用 GitHub Pages**：
   - 前往倉庫的 `Settings` → `Pages`
   - 在 `Source` 中選擇 `GitHub Actions`（不是 `Deploy from a branch`）
   - 保存設置

2. **推送代碼**：
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment"
   git push origin main
   ```
   - GitHub Actions 會自動構建並部署

3. **查看部署狀態**：
   - 前往 `Actions` 標籤頁查看部署進度
   - 部署完成後，訪問：`https://poirotw66.github.io/Sprite-Animator/`

### 手動觸發部署

如果需要立即部署：
- 前往 `Actions` 標籤頁
- 選擇 `CI` 工作流（建置與部署已合併於此，不再有獨立的 deploy workflow）
- 點擊 `Run workflow`

### 手動構建（本地測試）

如果需要本地測試 GitHub Pages 構建：

```bash
# 設置 GitHub Pages 環境變量
export GITHUB_PAGES=true

# 構建項目
npm run build

# 構建輸出在 dist/ 目錄
# 預覽構建結果
npm run preview
```

### 注意事項

- ✅ 部署後，應用會自動使用 `/Sprite-Animator/` 作為 base path
- ✅ 確保在 GitHub Pages 設置中選擇 `GitHub Actions` 作為源
- ✅ 首次部署可能需要 2-5 分鐘
- ✅ 每次推送到 `main` 分支都會自動觸發重新部署
- ⚠️ 如果倉庫名稱改變，需要更新 `vite.config.ts` 中的 base path

## 📝 技術棧

- **React 19** - UI 框架
- **React Router 7** - 多工具路由（各頁面採 lazy loading）
- **TypeScript** - 類型安全
- **Vite 6** - 構建工具
- **Tailwind CSS 4** - 樣式（透過 PostCSS 建置；`index.css` 定義 Signal Studio tokens）
- **Outfit / Noto Sans TC** - UI 字體（`@fontsource`）
- **IndexedDB** - LINE 貼圖作業與影像資產持久化
- **Google Gemini API** - AI 圖像生成
- **@huggingface/transformers** - AI 去背模型（需要時才載入）
- **upng-js** - APNG 編碼
- **gifenc** - GIF 編碼
- **jszip** - ZIP 打包
- **Python 3 + uv** - LINE 貼圖 sheet converter 與上傳自動化（見 `scripts/line-sticker/python/`）

## 🎯 最佳實踐

### API 配額優化

- **優先使用精靈圖模式**：僅需 1 次 API 請求
- **合理設置幀數**：逐幀模式中，幀數越多，請求次數越多
- **使用自訂 API Key**：可以獲得更高的速率限制

### 動畫質量提升

- **清晰的動作描述**：使用具體的動作名稱（如 "Run Cycle" 而非 "move"）
- **一致的風格**：上傳的角色圖片應該風格一致
- **適當的幀數**：4-8 幀通常足夠表現基本動作

### LINE 貼圖

- 重要作業請確認瀏覽器允許本站使用 IndexedDB／本機儲存
- 清除網站資料會一併刪除已還原的貼圖作業
- 量產與上傳請使用專用 skill／腳本，勿把 API Key 寫進 job 快照

## 🐛 故障排除
遇到問題請先參考 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

常見問題：
- **頁面空白**：檢查開發服務器是否運行，清除瀏覽器緩存
- **API 錯誤**：確認 API Key 正確設置
- **生成失敗**：檢查網絡連接和 API 配額
- **LINE 貼圖無法還原**：確認未清除網站資料；若顯示還原失敗提示，可重新開始一份作業

## 📄 許可證

本專案採用 [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](LICENSE.txt) 授權。

詳情請參閱 [LICENSE.txt](./LICENSE.txt)

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📚 相關文檔

- [切分與對齊流程](./docs/animation/SLICE_AND_ALIGN_FLOW.md) - 切分功能技術細節
- [去背改進說明](./docs/chroma/CHROMA_KEY.md) - 去背功能技術細節
- [背景顏色標準化](./docs/chroma/BACKGROUND_COLOR_NORMALIZATION.md) - 背景色統一處理
- [專案優化路線圖](./docs/PROJECT_OPTIMIZATION_ROADMAP.md) - 未來優化計劃
- [文件索引](./docs/README.md) - 完整技術文件目錄

---

**最後更新**：2026-09-09  
**版本**：v1.2.0
