# Fix: Display Inconsistency Between Frontend and Downloaded PNG
# 修正：前端顯示與下載 PNG 不一致

## 問題摘要

**報告時間**: 2026-01-30

**現象**:
- ✅ 下載的 PNG 檔案：去背正確，膚色正常
- ❌ 前端 Frame Grid 顯示：部分人物色彩（膚色）被誤去背

**影響範圍**:
- Frame Grid（切分後的小方格 1, 2, 3, 4, 5, 6）
- 可能也影響 Animation Preview

## 根本原因分析

### 問題定位

1. **下載使用的圖片**: `processedSpriteSheet`（完整的去背後精靈圖）✅ 正確
2. **前端顯示的幀**: `generatedFrames`（從 `processedSpriteSheet` 切分出來的）❌ 錯誤

**結論**: 問題出在 **切分過程** (`sliceSpriteSheet` 函數)

### 技術原因

在 `utils/imageUtils.ts` 的 `sliceSpriteSheet` 函數中：

#### 原因 1: 不必要的像素處理

**問題代碼**:
```typescript
// 即使 removeBg = false，仍然執行以下操作
const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
const data = imageData.data;

// Legacy background removal
if (removeBg) {
  // 處理...
}

ctx.putImageData(imageData, 0, 0); // ← 總是執行！
```

**問題**: `getImageData()` 和 `putImageData()` 會進行色彩空間轉換，即使不做任何處理，也可能改變像素值。

#### 原因 2: Canvas 預乘透明度 (Premultiplied Alpha)

**問題**: Canvas 預設使用預乘透明度模式，會將 RGB 值乘以 Alpha 值：

**範例**:
```
原始半透明像素: R:200, G:150, B:100, A:128
預乘後:         R:100, G:75,  B:50,  A:128
```

這會導致：
1. **邊緣色彩改變**: 半透明邊緣的顏色會變暗
2. **誤觸 chroma key 檢測**: 改變後的顏色可能符合背景色檢測規則
3. **膚色失真**: 膚色的 RGB 比例改變，可能被誤判為背景色

## 實施的修正

### 修正 1: 移除不必要的像素操作

**檔案**: `/Users/cfh00896102/Github/Sprite-Animator/utils/imageUtils.ts`

**修改位置**: Line 234-250

**修改內容**:
```typescript
// ❌ 修改前：總是執行 getImageData/putImageData
const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
const data = imageData.data;

if (removeBg) {
  // 處理...
}

ctx.putImageData(imageData, 0, 0);

// ✅ 修改後：只在需要時執行
if (removeBg) {
  const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
  const data = imageData.data;
  
  // 處理...
  
  ctx.putImageData(imageData, 0, 0);
}
```

**效果**: 
- 當 `removeBg = false` 時（正常情況），完全避免像素級操作
- 減少色彩空間轉換的機會
- 保持原始圖片的色彩精度

### 修正 2: 禁用預乘透明度

**檔案**: `/Users/cfh00896102/Github/Sprite-Animator/utils/imageUtils.ts`

**修改位置**: Line 128-132

**修改內容**:
```typescript
// ❌ 修改前
const ctx = canvas.getContext('2d', { 
  willReadFrequently: true,
  alpha: true,
  desynchronized: false
});

// ✅ 修改後
const ctx = canvas.getContext('2d', { 
  willReadFrequently: true,
  alpha: true,
  desynchronized: false,
  premultipliedAlpha: false // 防止透明度造成的色彩失真
});
```

**效果**:
- 保持 RGB 值不被 Alpha 值預乘
- 防止半透明像素的色彩改變
- 確保切分出的幀與原始圖片色彩一致

## 修正效果預期

### 修改前

```
processedSpriteSheet (正確)
  ↓
sliceSpriteSheet
  ↓ Canvas.drawImage()
  ↓ getImageData() ← 色彩空間轉換 + 預乘透明度
  ↓ putImageData() ← 可能再次轉換
  ↓ toDataURL()
  ↓
generatedFrames (錯誤：膚色被改變)
```

### 修改後

```
processedSpriteSheet (正確)
  ↓
sliceSpriteSheet (premultipliedAlpha: false)
  ↓ Canvas.drawImage()
  ↓ (跳過 getImageData/putImageData)
  ↓ toDataURL()
  ↓
generatedFrames (正確：保持原始色彩)
```

## 驗證步驟

### 步驟 1: 清除快取

```bash
# 在瀏覽器中
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows/Linux)
```

### 步驟 2: 重新生成

1. 輸入相同的 prompt
2. 等待生成完成
3. 觀察 Frame Grid 中的幀

### 步驟 3: 比較

1. 查看前端 Frame Grid 的膚色
2. 下載 PNG 檔案
3. 對比兩者是否一致

### 預期結果

✅ **修正成功**:
- Frame Grid 顯示的幀膚色正常
- 背景正確去除（綠色/洋紅色）
- 與下載的 PNG 完全一致

❌ **如果仍有問題**:
- 可能需要進一步調整 chroma key 檢測規則
- 或使用備用方案（見下方）

## 備用方案

如果修正後問題仍存在，可以考慮：

### 方案 A: 直接顯示完整精靈圖（不切分）

使用 CSS `clip-path` 來裁剪顯示區域，而不是實際切分圖片：

```tsx
<img
  src={processedSpriteSheet}
  style={{
    clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px)`,
    transform: `translate(-${left}px, -${top}px)`
  }}
/>
```

**優點**: 完全避免 Canvas 處理，保證色彩一致
**缺點**: 更複雜的 CSS 計算

### 方案 B: 使用 OffscreenCanvas

```typescript
const canvas = new OffscreenCanvas(frameWidth, frameHeight);
const ctx = canvas.getContext('2d', {
  alpha: true,
  premultipliedAlpha: false,
  colorSpace: 'srgb'
});
```

**優點**: 更好的效能和色彩控制
**缺點**: 不是所有瀏覽器都支援

### 方案 C: 調整 chroma key 檢測規則

如果真的是色彩改變觸發了誤檢測，可以：
1. 縮小綠色/洋紅色檢測範圍
2. 增加膚色保護規則
3. 調整 fuzz tolerance

## 技術文檔

相關文檔：
- `CANVAS_COLOR_SPACE_FIX.md` - Canvas 色彩空間詳細說明
- `DISPLAY_VS_DOWNLOAD_DEBUG.md` - 診斷流程
- `CHROMA_KEY_IMPROVEMENTS_V2.md` - Chroma key 改進歷史

## 修改文件清單

- ✅ `/Users/cfh00896102/Github/Sprite-Animator/utils/imageUtils.ts`
  - Line 131: 新增 `premultipliedAlpha: false`
  - Line 238-250: 條件化執行 `getImageData/putImageData`

## 待辦事項

- [ ] 使用者驗證修正效果
- [ ] 如仍有問題，實施備用方案
- [ ] 更新 README 和測試文檔

---

**修正日期**: 2026-01-30  
**狀態**: ✅ 已實施，等待驗證  
**影響範圍**: Frame Grid 顯示、Animation Preview
