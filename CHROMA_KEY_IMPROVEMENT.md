# 精靈圖去背改進說明

## 🎯 改進目標

實現類似 ImageMagick 的精確洋紅色去背，確保生成的動畫：
- ✅ 無白邊
- ✅ 無棋盤格
- ✅ 無框限錯覺
- ✅ 真正的 RGBA 透明

## 🔄 新的處理流程

### 舊流程（問題）
1. 生成精靈圖（洋紅色背景 #FF00FF）
2. 前端簡單去背（白色背景，threshold > 230）
3. 切片生成動畫
4. **問題**：無法正確處理洋紅色，會有白邊和殘留

### 新流程（改進）
1. **生成精靈圖**（洋紅色背景 #FF00FF）
2. **精確去背處理**（類似 ImageMagick）：
   - 使用 `removeChromaKey()` 函數
   - 處理洋紅色 #FF00FF
   - 容差 2%（fuzz 2%）
   - 使用歐幾里得距離計算顏色相似度
3. **顯示處理後的圖片**（已去背的精靈圖）
4. **切片處理後的圖片**（使用去背後的版本）
5. **生成動畫**（使用去背後的幀）

## 🛠️ 技術實現

### 1. 新增函數：`removeChromaKey()`

```typescript
/**
 * 類似 ImageMagick: magick sprite.png -fuzz 2% -transparent "#FF00FF" output.png
 */
export const removeChromaKey = async (
  base64Image: string,
  chromaKey: { r: 255, g: 0, b: 255 }, // #FF00FF
  fuzzPercent: number = 2 // 2% 容差
): Promise<string>
```

**算法**：
- 計算每個像素與洋紅色的歐幾里得距離
- 如果距離 ≤ fuzz 容差，設置 alpha = 0（透明）
- 保留其他像素不變

### 2. 處理流程整合

在 `useSpriteSheet` hook 中：

```typescript
// Step 1: 精確去背（自動執行）
const chromaKeyRemoved = await removeChromaKey(
  spriteSheetImage,
  CHROMA_KEY_COLOR, // {r: 255, g: 0, b: 255}
  CHROMA_KEY_FUZZ   // 2
);

// Step 2: 使用去背後的圖片進行切片
const frames = await sliceSpriteSheet(
  chromaKeyRemoved, // 使用處理後的圖片
  // ... 其他參數
  false // 不需要額外的白色背景去除
);
```

### 3. UI 更新

- 顯示處理後的精靈圖（已去背）
- 移除「去除白色背景」開關（精靈圖模式自動處理）
- 添加說明文字，解釋自動去背功能

## 📊 效果對比

### 舊方法（簡單去背）
- ❌ 無法處理洋紅色
- ❌ 會有白邊殘留
- ❌ 可能出現棋盤格效果
- ❌ 透明度不準確

### 新方法（精確去背）
- ✅ 正確處理洋紅色 #FF00FF
- ✅ 無白邊（2% 容差處理邊緣）
- ✅ 無棋盤格（真正的透明）
- ✅ 完美的 RGBA 透明度

## 🔧 配置參數

在 `utils/constants.ts` 中：

```typescript
export const CHROMA_KEY_COLOR = { r: 255, g: 0, b: 255 }; // #FF00FF
export const CHROMA_KEY_FUZZ = 2; // 2% 容差（可調整）
```

**調整建議**：
- `CHROMA_KEY_FUZZ = 2`：標準設置，適合大多數情況
- 如果去背不完整，可以增加到 3-5%
- 如果去背過度（影響角色），可以減少到 1%

## 🎨 使用示例

### 自動處理流程

1. 用戶生成精靈圖
2. 系統自動檢測並處理洋紅色背景
3. 顯示處理後的精靈圖（透明背景）
4. 用戶調整切片設定
5. 系統使用處理後的圖片進行切片
6. 生成的動畫幀都是完美透明的

### 手動測試

如果需要測試去背效果：

```typescript
import { removeChromaKey } from './utils/imageUtils';

const processed = await removeChromaKey(
  spriteSheetBase64,
  { r: 255, g: 0, b: 255 }, // 洋紅色
  2 // 2% 容差
);
```

## ⚠️ 注意事項

1. **性能**：去背處理在瀏覽器中進行，大圖片可能需要一些時間
2. **容差設置**：2% 是推薦值，過高可能影響角色顏色，過低可能無法完全去除背景
3. **僅限精靈圖模式**：逐幀模式仍使用白色背景去除（因為逐幀模式生成的是白色背景）

## 🚀 未來改進（可選）

1. **Web Worker**：將去背處理移到 Web Worker，避免阻塞 UI
2. **進度指示**：顯示去背處理進度
3. **可調整容差**：允許用戶調整 fuzz 百分比
4. **預覽對比**：顯示處理前後的對比

---

**實現日期**：2026-01-25
**版本**：v1.1.0-chroma-key
