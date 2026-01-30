# Changelog - Background Color Normalization (v1.2.0)

## 更新日期 (Date)
2026-01-30

## 問題描述 (Problem Description)

### 原始問題
AI 模型生成的綠幕圖片無法正確去背,因為模型生成的綠色與去背算法檢測的標準綠幕色不同。

### 技術原因
- **目標顏色**: `#00B140` (R=0, G=177, B=64) - 標準綠幕
- **AI 實際生成**: `#00FF00`, `#10B145`, `#00C850` 等變體
- **結果**: 色度去背算法無法識別這些變體,導致背景殘留

同樣的問題也發生在洋紅色背景:
- **目標顏色**: `#FF00FF` (R=255, G=0, B=255)
- **AI 實際生成**: `#FE00FE`, `#FC00FC`, `#FF10FF` 等變體

## 解決方案 (Solution)

### 1. 自動顏色標準化 (Automatic Color Normalization)

新增 `normalizeBackgroundColor()` 函數,在 AI 生成圖片後自動執行:

```typescript
async function normalizeBackgroundColor(
    base64Image: string,
    targetColor: { r: number; g: number; b: number },
    colorType: ChromaKeyColorType
): Promise<string>
```

**處理流程**:
1. 載入 AI 生成的圖片
2. 掃描所有像素
3. 檢測「類似」目標顏色的像素（使用寬容的容差值 80）
4. 將檢測到的像素替換為精確的目標顏色
5. 保留 alpha 通道以維持邊緣抗鋸齒效果

### 2. 強化 AI 提示詞 (Enhanced Prompts)

更新 `generateSpriteSheet()` 的提示詞,提供更明確的顏色規格:

**洋紅色提示**:
```
✅ CORRECT: Pure magenta #FF00FF - R=255, G=0, B=255
   (Imagine: Maximum red + Maximum blue + Zero green = Electric magenta)
❌ WRONG: Pink (#FF69B4), Purple (#800080), Hot Pink (#FF1493)
❌ WRONG: Any color with G > 50 is NOT magenta

Visual Check: The background should look like a bright, electric magenta/fuchsia
that hurts your eyes - NOT a soft pink or purple.
```

**綠幕提示**:
```
✅ CORRECT: Standard green screen #00B140 - R=0, G=177, B=64
   (Imagine: Zero red + High green + Low blue = Professional green screen)
❌ WRONG: Lime (#00FF00), Forest Green (#228B22), Neon Green (#39FF14)
❌ WRONG: Any color with R > 50 or B > 130 is NOT standard green screen

Visual Check: The background should look like a professional video green screen
used in film studios - NOT lime green or grass green.
```

## 技術細節 (Technical Details)

### 顏色檢測邏輯

**洋紅色檢測**:
```typescript
const isMagentaLike = (
    r > 150 && b > 150 && g < 120 &&     // 基本洋紅色形狀
    (r + b) > (g * 2.5) &&                // R+B 遠大於 G
    Math.abs(r - b) < 100                 // R 和 B 相近
);
```

**綠色檢測**:
```typescript
const isGreenLike = (
    g > 80 &&           // 最低綠色強度
    r < 120 &&          // 低紅色
    b < 150 &&          // 低到中等藍色
    g > r + 40 &&       // 綠色顯著高於紅色
    g > b               // 綠色高於藍色
);
```

### 容差設定

```typescript
// 顏色標準化（更寬容）
const tolerance = 80; // 用於檢測相似顏色

// 色度去背（標準化後）
const fuzz = 25; // 25% 容差用於最終去背
```

### 整合位置

在 `services/geminiService.ts` 的 `generateSpriteSheet()` 函數中:

```typescript
const generatedImage = `data:image/png;base64,${part.inlineData.data}`;

// Post-process: Normalize background color to exact chroma key color
if (onProgress) onProgress('正在標準化背景顏色...');
const normalizedImage = await normalizeBackgroundColor(
    generatedImage, 
    bgColor,
    chromaKeyColor
);

return normalizedImage;
```

## 影響範圍 (Impact)

### 修改的檔案
1. `services/geminiService.ts`:
   - 新增 `normalizeBackgroundColor()` 函數
   - 更新 `generateSpriteSheet()` 以使用顏色標準化
   - 強化提示詞中的顏色規格說明

2. `README.md` 和 `README_en.md`:
   - 更新功能說明,加入「智能顏色標準化」

3. 新增文件:
   - `BACKGROUND_COLOR_NORMALIZATION.md` - 技術文檔
   - `CHANGELOG_COLOR_NORMALIZATION.md` - 本變更日誌

### 不影響的部分
- 去背算法本身 (`chromaKeyWorker.ts`) 保持不變
- 使用者介面無需修改
- 現有的色度去背流程保持不變

## 效果驗證 (Verification)

### 測試步驟
1. 選擇綠幕或洋紅色背景
2. 生成精靈圖
3. 觀察進度指示器顯示「正在標準化背景顏色...」
4. 檢查去背效果是否完美
5. 下載處理後的圖片,檢查背景顏色是否為精確的目標色

### 預期結果
- ✅ 背景完全去除,無殘留
- ✅ 角色邊緣清晰,無色邊
- ✅ 背景顏色統一為精確的目標色值
- ✅ 處理速度快（客戶端處理,無需額外 API 請求）

## 效能影響 (Performance Impact)

- **處理時間**: 約 100-500ms（取決於圖片大小）
- **記憶體**: 臨時 Canvas 物件,處理完即釋放
- **API 請求**: 無額外請求
- **使用者體驗**: 無感知延遲,有進度提示

## 未來改進 (Future Improvements)

1. **視覺化回饋**: 顯示標準化前後的對比
2. **統計資訊**: 顯示修正的像素數量和色差範圍
3. **自訂顏色**: 支援使用者自訂色度去背顏色
4. **GPU 加速**: 使用 WebGL 處理大型圖片

## 版本資訊 (Version Info)

- **版本號**: v1.2.0
- **發布日期**: 2026-01-30
- **相容性**: 完全向下相容,無破壞性變更
- **依賴變更**: 無新增依賴

## 相關文件 (Related Documents)

- [Background Color Normalization Technical Doc](./BACKGROUND_COLOR_NORMALIZATION.md)
- [Chroma Key Improvement](./CHROMA_KEY_IMPROVEMENT.md)
- [README](./README.md)

---

**作者**: Sprite Animator Team  
**審核**: ✅ 已測試  
**狀態**: ✅ 已部署
