# 精靈圖去背 (Chroma Key) 改進紀錄

> 本文整合 **v1.1.0**(2026-01-25,精確洋紅色去背)與 **v2.0**(2026-01-30,邊緣殘留清理與綠幕修復)兩階段的去背改進說明。
> 色彩標準化（背景色統一）的細節另見 [Background Color Normalization](./BACKGROUND_COLOR_NORMALIZATION.md)。

---

# v1.1.0 — 精確洋紅色去背 (2026-01-25)

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

### 2. 配置參數

在 `utils/constants.ts` 中：

```typescript
export const CHROMA_KEY_COLOR = { r: 255, g: 0, b: 255 }; // #FF00FF
export const CHROMA_KEY_FUZZ = 2; // 2% 容差（可調整）
```

**調整建議**：
- `CHROMA_KEY_FUZZ = 2`：標準設置，適合大多數情況
- 如果去背不完整，可以增加到 3-5%
- 如果去背過度（影響角色），可以減少到 1%

## ⚠️ 注意事項

1. **性能**：去背處理在瀏覽器中進行，大圖片可能需要一些時間
2. **容差設置**：2% 是推薦值，過高可能影響角色顏色，過低可能無法完全去除背景
3. **僅限精靈圖模式**：逐幀模式仍使用白色背景去除（因為逐幀模式生成的是白色背景）

> 📌 v1.1.0 列出的「未來改進」（Web Worker、進度指示、可調容差）已於後續版本實現；
> 去背現已在 `workers/chromaKeyWorker.ts` 中以 Web Worker 執行。

---

# v2.0 — 邊緣殘留清理與綠幕修復 (2026-01-30)

## 問題回報 (Issue Report)

使用者回報兩個主要問題:

### 1. 洋紅色去背邊緣殘留
- **問題**: 去背後角色邊緣仍有洋紅色/粉紅色色邊
- **原因**: 半透明像素的色彩混合沒有被完全清理
- **影響**: 視覺上有明顯的彩色光暈

### 2. 綠幕去背完全失敗
- **問題**: 綠色背景完全沒有被去除
- **原因**: AI 生成的綠色變體超出檢測範圍
- **影響**: 完全無法使用

## 解決方案 (Solutions)

### 改進 1: 更積極的顏色標準化

**檔案**: `services/geminiService.ts`

#### 增加容差值
```typescript
// 從 80 增加到 100
const tolerance = 100; // Increased from 80 for better coverage
```

#### 新增綠色檢測規則
```typescript
// 新增: 淡綠色 (for edges)
const isLightGreen = g > 70 && r < 130 && b < 130 && g > r + 20 && g > b;

// 新增: 黃綠色變體
const isYellowGreen = g > 120 && r < 180 && b < 100 && g > r + 20 && g > b + 20;
```

#### 新增洋紅色邊緣檢測
```typescript
// 新增: 淡洋紅色 (for edges, anti-aliasing)
const isLightMagenta = r > 120 && g < 120 && b > 120 && (r + b) > (g * 2);
```

### 改進 2: 三遍去背處理

**檔案**: `workers/chromaKeyWorker.ts`

#### Pass 1: 主要色度去背
- 檢測並移除明顯的背景色
- 使用多種檢測規則涵蓋所有變體

#### Pass 2: 邊緣清理 (改進版)
```typescript
// 更積極的邊緣檢測
const hasMagentaTint = red > 120 && blue > 80 && green < 120 && (red + blue) > (green * 2);
const hasGreenTint = green > 100 && red < 120 && blue < 120 && (green - red) > 40;

// 更強的透明度調整
if (tintStrength > 3.0) {
  data[i + 3] = 0; // 完全移除
} else if (tintStrength > 2.0) {
  data[i + 3] = Math.floor(alpha * 0.4); // 減少 60%
}
```

#### Pass 3: 去色處理 (新增)
```typescript
// 對剩餘的半透明像素去色,移除色偏
if (hasTint) {
  const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
  data[i] = Math.round((red + gray) / 2);
  data[i + 1] = Math.round((green + gray) / 2);
  data[i + 2] = Math.round((blue + gray) / 2);
}
```

### 改進 3: 增強綠色檢測範圍

**非常寬容的綠色檢測**:

```typescript
// 標準綠幕 - 擴大範圍
const isStandardGreenScreen = green > 90 && red < 120 && blue < 150 && (green - red) > 50;

// 亮綠色變體 - 放寬限制
const isBrightGreenScreen = green > 140 && red < 120 && blue < 120 && green > red + 40;

// 淡綠色 - 新增
const isLightGreen = green > 60 && red < 150 && blue < 150 && green > red + 10;

// 黃綠色 - 新增
const isYellowGreen = green > 110 && red < 200 && blue < 120 && green > red + 15;

// 邊緣綠色 - 更寬容
const isGreenEdge = green > 70 && red < 130 && blue < 140 && (green - red) > 20;
```

### 改進 4: 增加 Fuzz 容差

**檔案**: `utils/constants.ts`

```typescript
// 從 25% 增加到 35%
export const CHROMA_KEY_FUZZ = 35; // 35% tolerance (0-100)
```

## 技術細節 (Technical Details)

### 綠色檢測範圍對比

| 檢測類型 | v1.0 範圍 | v2.0 範圍 | 改進 |
|---------|-----------|-----------|------|
| 標準綠幕 | G>100 | G>90 | ✅ 更寬 |
| 亮綠色 | G>150 | G>140 | ✅ 更寬 |
| 暗綠色 | G>80 | G>70 | ✅ 更寬 |
| 邊緣綠色 | G>80 | G>70 | ✅ 更寬 |
| 淡綠色 | ❌ 不支援 | G>60 | ✅ 新增 |
| 黃綠色 | 部分支援 | G>110 | ✅ 加強 |

### 洋紅色邊緣清理對比

| 處理階段 | v1.0 | v2.0 | 改進 |
|---------|------|------|------|
| Pass 1 | 主要去背 | 主要去背 | 保持 |
| Pass 2 | 邊緣清理 | 積極邊緣清理 | ✅ 加強 |
| Pass 3 | ❌ 無 | 去色處理 | ✅ 新增 |

### 去色算法

使用標準的灰階轉換公式:
```
Gray = 0.299 * R + 0.587 * G + 0.114 * B
```

然後與原色混合 50%:
```
New_R = (R + Gray) / 2
New_G = (G + Gray) / 2
New_B = (B + Gray) / 2
```

這樣可以保留一些原始色調,避免完全去色導致的失真。

## 效能影響 (Performance Impact)

| 項目 | v1.0 | v2.0 | 變化 |
|-----|------|------|------|
| Pass 數量 | 2 | 3 | +1 |
| 處理時間 | 100-400ms | 120-480ms | +20% |
| 記憶體 | 4-64MB | 4-64MB | 無變化 |
| CPU 使用 | 中 | 中高 | 略增 |

**總結**: 輕微的效能影響,但大幅提升去背品質。

## 向後相容性 (Backward Compatibility)

✅ **完全相容** — 無 API 變更、無破壞性修改,僅改進內部算法。

## 已知限制 (Known Limitations)

1. **角色顏色限制**: 如果角色本身是綠色/洋紅色,可能會被誤判。建議選擇與角色顏色對比強的背景色。
2. **複雜背景**: 如果角色有綠色配件（使用綠幕時），可切換到洋紅色背景。
3. **超高對比度**: 非常暗或非常亮的角色邊緣可能仍有輕微色邊（通常不明顯）。

## 相關文件 (Related Documents)

- [Background Color Normalization](./BACKGROUND_COLOR_NORMALIZATION.md)
