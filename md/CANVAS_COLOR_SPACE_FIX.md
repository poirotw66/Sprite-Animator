# Canvas Color Space Fix
# Canvas 色彩空間修正

## 問題診斷

### 現象
- 下載的 PNG 正確 ✅
- 前端 Frame Grid 顯示的切分後幀錯誤（膚色被去背） ❌

### 根本原因

Canvas 在處理圖片時可能會進行色彩空間轉換（color space conversion），導致：
1. **預乘透明度 (Premultiplied Alpha)**: 半透明像素的 RGB 值會被預乘 Alpha 值
2. **色彩空間轉換**: sRGB ↔ Linear RGB 轉換可能改變像素值
3. **色彩配置文件 (Color Profile)**: 不同設備/瀏覽器可能使用不同的色彩配置

## 已實施的修正

### 修正 1: 移除不必要的 `getImageData/putImageData`

**檔案**: `utils/imageUtils.ts` → `sliceSpriteSheet`

**問題**: 即使 `removeBg = false`，仍會執行不必要的像素處理

**修正**:
```typescript
// 只在 removeBg = true 時才處理像素
if (removeBg) {
  const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
  // ... 處理 ...
  ctx.putImageData(imageData, 0, 0);
}
```

### 修正 2: 禁用預乘透明度

**檔案**: `utils/imageUtils.ts` → `sliceSpriteSheet`

**問題**: Canvas 預設會使用預乘透明度，可能導致色彩失真

**修正**:
```typescript
const ctx = canvas.getContext('2d', { 
  willReadFrequently: true,
  alpha: true,
  desynchronized: false,
  premultipliedAlpha: false // CRITICAL: 防止透明度造成的色彩失真
});
```

**說明**: 預乘透明度會將 RGB 值乘以 Alpha 值，例如：
- 原始：`R:200, G:100, B:100, A:128`
- 預乘後：`R:100, G:50, B:50, A:128`

這會導致半透明邊緣的顏色改變，可能誤觸 chroma key 檢測！

## 下一步驗證

### 測試步驟

1. **清除快取並重新整理頁面**
   ```
   Cmd + Shift + R (Mac) 或 Ctrl + Shift + R (Windows)
   ```

2. **重新生成精靈圖**
   - 輸入相同的 prompt
   - 觀察前端 Frame Grid 顯示

3. **比較結果**
   - 下載 PNG 檔案
   - 對比前端顯示的 Frame Grid
   - 確認膚色是否正常

### 預期結果

修正後，Frame Grid 中的幀應該：
- ✅ 保留正確的膚色
- ✅ 正確去除背景（綠色/洋紅色）
- ✅ 與下載的 PNG 一致

## 備用方案

如果問題仍然存在，可能需要：

### 方案 A: 使用 OffscreenCanvas

```typescript
const canvas = new OffscreenCanvas(frameWidth, frameHeight);
const ctx = canvas.getContext('2d', {
  alpha: true,
  premultipliedAlpha: false,
  colorSpace: 'srgb'
});
```

### 方案 B: 強制色彩空間

```typescript
const ctx = canvas.getContext('2d', {
  alpha: true,
  colorSpace: 'display-p3' // 或 'srgb'
});
```

### 方案 C: 避免使用 Canvas 切分

直接使用 CSS `clip-path` 或 `object-fit` 來顯示幀：

```tsx
<img
  src={processedSpriteSheet}
  style={{
    objectFit: 'none',
    objectPosition: `-${x}px -${y}px`,
    width: `${cellWidth}px`,
    height: `${cellHeight}px`
  }}
/>
```

## 技術細節

### Canvas 色彩處理流程

```
原始圖片 (processedSpriteSheet)
  ↓
Canvas.drawImage() ← 可能發生色彩空間轉換
  ↓
getImageData() ← 取得像素數據（可能已轉換）
  ↓
putImageData() ← 寫回像素數據
  ↓
toDataURL() ← 轉為 base64（可能再次轉換）
  ↓
<img src={base64}> ← 瀏覽器顯示
```

### 潛在問題點

1. **drawImage**: 可能將圖片從一個色彩空間轉到另一個
2. **getImageData**: 返回的數據可能已經過預乘或轉換
3. **toDataURL**: 可能應用色彩配置或壓縮

### 最佳實踐

為確保色彩一致性：
1. ✅ 使用 `premultipliedAlpha: false`
2. ✅ 避免不必要的 `getImageData/putImageData`
3. ✅ 禁用圖片平滑：`imageSmoothingEnabled = false`
4. ⏳ 如需更精確，明確指定 `colorSpace: 'srgb'`

---

**更新日期**: 2026-01-30  
**狀態**: 已實施修正，等待使用者驗證
