# 角色幀動畫生成器 (Sprite Animator)

一個使用 Google Gemini AI 生成 2D 角色動畫的工具，支持逐幀模式和精靈圖模式。

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## ✨ 功能特色

- 🎨 **兩種生成模式**：
  - **逐幀模式**：逐個生成動畫幀，適合複雜動作
  - **精靈圖模式**：一次生成完整精靈圖，節省 API 配額（僅需 1 次請求）

- 🖼️ **靈活的精靈圖處理**：
  - 可調整網格切分（Cols/Rows）
  - 支持 Padding（縮放）和 Shift（位移）調整
  - 自動去除白色背景
  - 實時預覽網格切分效果

- 📤 **多種導出格式**：
  - APNG（高清，支持透明）
  - GIF（兼容性好）
  - ZIP（所有幀的原始 PNG 文件）

- ⚡ **性能優化**：
  - React 性能優化（useMemo, useCallback, React.memo）
  - 代碼分割（動態導入）
  - 使用 requestAnimationFrame 實現流暢動畫

- 🛡️ **穩定性**：
  - 完整的 TypeScript 類型支持
  - 錯誤邊界（Error Boundary）
  - 統一的錯誤處理
  - 自動重試機制（帶指數退避）

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
- **Shift（位移）**：微調切分位置
- **去除背景**：自動移除白色/淺色背景

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
│   └── imageUtils.ts
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

本專案為開源專案。

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

**在 AI Studio 中查看**：https://ai.studio/apps/drive/1Yl3nv0fPcJJk8Z_0QgnH7CcCaDni6Ce3
