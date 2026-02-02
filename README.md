# 角色幀動畫生成器 (Sprite Animator)
[English](./README_en.md) | [繁體中文](./README.md)

## ✨ 功能特色

- 🎨 **兩種生成模式**：
  - **逐幀模式**：逐個生成動畫幀，適合複雜動作
  - **精靈圖模式**：一次生成完整精靈圖，節省 API 配額（僅需 1 次請求）

- 🖼️ **靈活的精靈圖處理**：
  - 可調整網格切分（Cols/Rows）
  - 支持 Padding（縮放）和 Shift（位移）調整
  - **自動精確去背**：類似 ImageMagick 的色度去背（支援洋紅色 #FF00FF 和綠幕 #00B140）
  - **智能顏色標準化**：自動修正 AI 生成的色差,確保完美去背
  - 實時預覽網格切分效果
  - **工業級切分**：整數座標、邊界檢查、像素完美對齊

- 📤 **多種導出格式**：
  - APNG（高清，支持透明）
  - GIF（兼容性好）
  - ZIP（所有幀的原始 PNG 文件）

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

## 🚀 快速開始

### 環境要求

- Node.js 18+ 
- npm 或 yarn

### 安裝步驟

1. **克隆或下載專案**

2. **安裝依賴**：
   ```bash
   npm install
   ```

3. **設置環境變量**（可選）：
   創建 `.env.local` 文件：
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   或者直接在應用中通過設定界面輸入 API Key。

4. **啟動開發服務器**：
   ```bash
   npm run dev
   ```

5. **打開瀏覽器**：
   訪問 `http://localhost:3000`

## 📖 使用指南

### 基本流程

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
| <img src="images/gemini.png" alt="原圖 gemini" width="300"> |
| **gemini.png** — 角色原檔 |

### 生成結果（輸出）

使用本工具選擇**精靈圖模式**或**逐幀模式**，輸入動作提示詞後生成動畫，再導出為 GIF：

| 動作 | 生成 GIF |
|------|----------|
| 開心 | ![開心](images/開心.gif) |
| 揮手 | ![揮手](images/揮手.gif) |
| 偏頭疑惑 | ![偏頭疑惑](images/偏頭疑惑.gif) |
| 生氣 | ![生氣](images/生氣.gif) |

以上 GIF 皆由 **gemini.png** 作為原圖，經本工具搭配 Google Gemini API 生成幀動畫後導出。

## 🏗️ 專案結構

```
Sprite-Animator/
├── components/          # React 組件
│   ├── SettingsModal.tsx
│   ├── ImageUpload.tsx
│   ├── AnimationConfigPanel.tsx
│   ├── SpriteSheetViewer.tsx
│   ├── AnimationPreview.tsx
│   ├── FrameGrid.tsx
│   ├── ErrorBoundary.tsx
│   └── Icons.tsx
├── hooks/               # 自定義 Hooks
│   ├── useSettings.ts
│   ├── useAnimation.ts
│   ├── useSpriteSheet.ts
│   └── useExport.ts
├── services/            # API 服務
│   └── geminiService.ts
├── utils/               # 工具函數
│   ├── constants.ts
│   ├── imageUtils.ts
│   ├── chromaKeyProcessor.ts  # 去背處理器（Web Worker）
│   └── logger.ts              # 日誌工具
├── workers/            # Web Workers
│   └── chromaKeyWorker.ts     # 去背處理 Worker
├── types/               # TypeScript 類型定義
│   ├── index.ts
│   └── errors.ts
├── App.tsx              # 主應用組件
├── index.tsx            # 入口文件
└── vite.config.ts       # Vite 配置
```

## 🔧 開發

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
- 選擇 `Deploy to GitHub Pages` 工作流
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
- **TypeScript** - 類型安全
- **Vite** - 構建工具
- **Tailwind CSS** - 樣式（通過 CDN）
- **Google Gemini API** - AI 圖像生成
- **upng-js** - APNG 編碼
- **gifenc** - GIF 編碼
- **jszip** - ZIP 打包

## 🎯 最佳實踐

### API 配額優化

- **優先使用精靈圖模式**：僅需 1 次 API 請求
- **合理設置幀數**：逐幀模式中，幀數越多，請求次數越多
- **使用自訂 API Key**：可以獲得更高的速率限制

### 動畫質量提升

- **清晰的動作描述**：使用具體的動作名稱（如 "Run Cycle" 而非 "move"）
- **一致的風格**：上傳的角色圖片應該風格一致
- **適當的幀數**：4-8 幀通常足夠表現基本動作

## 🐛 故障排除

如果遇到問題，請查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

常見問題：
- **頁面空白**：檢查開發服務器是否運行，清除瀏覽器緩存
- **API 錯誤**：確認 API Key 正確設置
- **生成失敗**：檢查網絡連接和 API 配額

## 📄 許可證

本專案採用 [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](LICENSE.txt) 授權。

詳情請參閱 [LICENSE.txt](./LICENSE.txt)

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📚 相關文檔

- [精靈圖切分分析](./SPRITE_SLICING_ANALYSIS.md) - 切分功能優化詳情
- [去背改進說明](./CHROMA_KEY_IMPROVEMENT.md) - 去背功能技術細節
- [專案優化路線圖](./PROJECT_OPTIMIZATION_ROADMAP.md) - 未來優化計劃

---

**最後更新**：2026-01-26  
**版本**：v1.2.0


