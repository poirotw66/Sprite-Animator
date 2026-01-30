# Display vs Download Inconsistency Debug
# 前端顯示與下載不一致診斷

## 問題描述 (Problem)

**現象**: 前端顯示的精靈圖與下載的 PNG 不一致

## 數據流程分析 (Data Flow Analysis)

### 1. 圖片生成流程

```
AI生成原圖 (spriteSheetImage)
    ↓
顏色標準化 (normalizeBackgroundColor) - 在 geminiService.ts
    ↓
色度去背 (removeChromaKeyWithWorker) - 使用 chromaKeyWorker.ts
    ↓
processedSpriteSheet（去背後完整圖）
    ↓
┌───────────────┬───────────────────┐
│               │                   │
下載            切分                 前端顯示精靈圖
(PNG)      (sliceSpriteSheet)     (processedSpriteSheet)
│               │                   │
✓ 正常          generatedFrames    ？可能有問題
                    │
                前端顯示動畫幀
                （FrameGrid, AnimationPreview）
```

### 2. 下載使用的圖片

**檔案**: `App.tsx` → `wrappedDownloadSpriteSheet`
```typescript
const imageToDownload = processedSpriteSheet || spriteSheetImage;
handleDownloadSpriteSheet(imageToDownload);
```

**結論**: 下載 `processedSpriteSheet`（完整去背後圖）

### 3. 前端顯示精靈圖使用的圖片

**檔案**: `App.tsx` → `SpriteSheetViewer`
```typescript
<SpriteSheetViewer
  spriteSheetImage={processedSpriteSheet}  // 已修改為只傳去背後圖
  ...
/>
```

**結論**: 顯示 `processedSpriteSheet`（應該與下載一致）

### 4. 前端顯示動畫幀使用的圖片

**檔案**: `hooks/useSpriteSheet.ts`
```typescript
const frames = await sliceSpriteSheet(
  processedSpriteSheet,  // 從去背後圖切分
  ...
  false,  // 不做額外去背
  ...
);
setGeneratedFrames(frames);
```

**結論**: `generatedFrames` 是從 `processedSpriteSheet` 切分出來的

## 可能的不一致原因 (Possible Causes)

### 原因 1: `isChromaKeyPixel` 誤判 ✅ 已修正

**位置**: `utils/imageUtils.ts`

**問題**: 此函數在 `analyzeFrameContent` 中用於計算邊界框。如果誤判人物顏色為背景色，會導致:
- 邊界框計算錯誤
- 自動優化設定錯誤
- **但不影響實際去背**（去背在 Worker 中完成）

**狀態**: ✅ 已修正（使用更嚴格的檢測）

### 原因 2: CSS 渲染差異

**位置**: 
- `components/SpriteSheetViewer.tsx`
- `components/FrameGrid.tsx`
- `components/AnimationPreview.tsx`

**可能問題**:
1. **圖片縮放**: `transform: scale()` 可能影響顯示
2. **圖片插值**: `imageRendering: 'pixelated'` vs 瀏覽器預設
3. **Canvas 渲染設定**: `imageSmoothingEnabled: false`
4. **透明度混合**: Alpha blending mode

### 原因 3: FrameGrid 中的額外處理

**位置**: `components/FrameGrid.tsx`

**檢查**: FrameGrid 在顯示 frame 時是否有額外處理?

```typescript
// FrameGrid.tsx line 676-678
<img
  src={frame}  // 直接顯示 base64
  alt={`Frame ${idx + 1}`}
  className="w-full h-full object-contain p-1"
/>
```

**結論**: 沒有額外處理，直接顯示

### 原因 4: 切分邏輯中的 `isChromaKeyPixel` 使用

**位置**: `utils/imageUtils.ts` → `analyzeFrameContent`

**影響**: 
- 此函數用於自動優化切分設定
- 如果誤判，會影響 padding/shift 計算
- **不會改變圖片內容，只影響切分位置**

## 診斷步驟 (Diagnostic Steps)

### 步驟 1: 確認是「整張精靈圖」還是「切分後的幀」不一致

**測試 A**: 檢查 SpriteSheetViewer 顯示的完整精靈圖
- 如果完整精靈圖與下載一致 → 問題在**切分後**
- 如果完整精靈圖與下載不一致 → 問題在**顯示渲染**

### 步驟 2: 檢查瀏覽器開發者工具

**操作**:
1. 打開 Chrome DevTools
2. 在 Network 面板查看圖片
3. 右鍵點擊精靈圖 → "Open in new tab"
4. 對比新分頁顯示的圖片與頁面上的顯示

### 步驟 3: 檢查 Canvas 渲染

**測試**: 在 Console 執行
```javascript
// 取得 processedSpriteSheet
const img = document.querySelector('img[alt="Sprite Sheet"]');
console.log('Displayed image src:', img?.src.substring(0, 100) + '...');

// 取得下載的圖片
console.log('processedSpriteSheet:', processedSpriteSheet?.substring(0, 100) + '...');

// 比較是否相同
console.log('Are they the same?', img?.src === processedSpriteSheet);
```

### 步驟 4: 檢查切分後的幀

**測試**: 比較 `generatedFrames[0]` 與手動切分的結果
```javascript
// 在 Console
const frame = generatedFrames[0];
console.log('Frame 0 length:', frame.length);
console.log('Frame 0 preview:', frame.substring(0, 100) + '...');
```

## 臨時解決方案 (Workarounds)

### 方案 1: 禁用圖片縮放和插值

**修改**: `components/AnimationPreview.tsx` 和 `components/FrameGrid.tsx`

```typescript
// 確保這些 CSS 屬性
style={{
  imageRendering: 'pixelated',  // 防止插值
  imageRendering: '-moz-crisp-edges',  // Firefox
  imageRendering: 'crisp-edges',  // 標準
}}
```

### 方案 2: 使用相同的渲染方式

**建議**: Canvas 渲染時使用與下載相同的設定

```typescript
ctx.imageSmoothingEnabled = false;
ctx.imageSmoothingQuality = 'low';
```

### 方案 3: 直接下載完整精靈圖而非切分後幀

**如果問題在切分**: 可以選擇下載完整精靈圖

## 調試腳本 (Debug Script)

在瀏覽器 Console 執行以下腳本來診斷問題:

```javascript
// 1. 檢查 processedSpriteSheet 是否存在
console.log('Has processedSpriteSheet:', !!window.processedSpriteSheet);

// 2. 檢查顯示的圖片
const displayedImg = document.querySelector('img[alt="Sprite Sheet"]');
console.log('Displayed image:', displayedImg?.src?.substring(0, 100) + '...');

// 3. 檢查動畫幀
const frameImgs = document.querySelectorAll('img[alt^="Frame"]');
console.log('Number of frames:', frameImgs.length);
console.log('Frame 1 src:', frameImgs[0]?.src?.substring(0, 100) + '...');

// 4. 比較圖片數據
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const testImg = new Image();
testImg.onload = () => {
  canvas.width = testImg.width;
  canvas.height = testImg.height;
  ctx.drawImage(testImg, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  console.log('Image dimensions:', canvas.width, 'x', canvas.height);
  console.log('First pixel RGBA:', 
    imageData.data[0], 
    imageData.data[1], 
    imageData.data[2], 
    imageData.data[3]
  );
};
testImg.src = displayedImg?.src;
```

## 下一步行動 (Next Steps)

1. ✅ 已修正 `isChromaKeyPixel` 的誤判問題
2. ⏳ **需要使用者確認**: 
   - 是「完整精靈圖」顯示不一致？
   - 還是「切分後的動畫幀」顯示不一致？
3. ⏳ 根據確認結果進行進一步修正

## 預期結果 (Expected Result)

修正 `isChromaKeyPixel` 後:
- ✅ 邊界框計算正確
- ✅ 自動優化不會誤判
- ✅ 前端顯示應與下載一致

如果仍有問題，可能是 CSS 渲染差異，需要進一步調整渲染設定。

---

**更新日期**: 2026-01-30  
**狀態**: 等待使用者確認具體不一致情況
