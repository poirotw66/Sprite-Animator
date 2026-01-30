# 精靈圖切分功能分析與優化方案

## 📊 當前實現分析

### 現有實現的問題

1. **精度損失問題**
   - 使用 `Math.floor(cellWidth)` 和 `Math.floor(cellHeight)` 會丟失小數部分
   - 累積誤差可能導致最後一列/行被截斷

2. **紋理滲漏風險（Texture Bleeding）**
   - 使用浮點數座標 `sx, sy` 可能導致瀏覽器採樣相鄰像素
   - 不同瀏覽器對浮點座標的處理不一致（Chrome/Firefox vs Edge/Safari）

3. **性能問題**
   - 每次切分都重新創建 canvas 和 context
   - 沒有重用資源

4. **邊界檢查不足**
   - 沒有檢查源座標是否超出圖片範圍
   - 可能導致黑色邊框或錯誤像素

5. **像素對齊問題**
   - 沒有確保像素完美對齊到整數座標
   - 可能導致模糊或失真

## 🎯 工業級改進方案

### 1. 使用整數座標系統
- 所有座標計算使用整數，避免浮點誤差
- 使用 `Math.round()` 而非 `Math.floor()` 進行更精確的四捨五入

### 2. 像素完美對齊
- 確保源座標和目標座標都是整數
- 使用 `Math.round()` 處理座標計算

### 3. 邊界檢查與裁剪
- 檢查源矩形是否在圖片範圍內
- 自動裁剪超出範圍的部分

### 4. 性能優化
- 重用 canvas 和 context
- 使用 `OffscreenCanvas`（如果支持）
- 批量處理多個幀

### 5. 錯誤處理增強
- 更詳細的錯誤訊息
- 驗證輸入參數
- 處理邊緣情況

### 6. 可選：Web Worker 支持
- 對於大圖片，使用 Web Worker 避免阻塞主線程
- 提高響應性

## 📝 改進後的實現特點

1. **精確的座標計算**
   ```typescript
   // 使用整數座標，避免浮點誤差
   const sx = Math.round(startX + c * cellWidth);
   const sy = Math.round(startY + r * cellHeight);
   ```

2. **邊界檢查**
   ```typescript
   // 確保不超出圖片範圍
   const sourceX = Math.max(0, Math.min(sx, totalWidth - 1));
   const sourceY = Math.max(0, Math.min(sy, totalHeight - 1));
   ```

3. **像素完美對齊**
   ```typescript
   // 確保所有尺寸都是整數
   const frameWidth = Math.round(cellWidth);
   const frameHeight = Math.round(cellHeight);
   ```

4. **資源重用**
   ```typescript
   // 重用 canvas，避免重複創建
   canvas.width = frameWidth;
   canvas.height = frameHeight;
   ```

5. **錯誤處理**
   ```typescript
   // 驗證參數
   if (cols <= 0 || rows <= 0) {
     throw new Error('Invalid grid dimensions');
   }
   ```

## 🔧 實施優先級

### 高優先級（立即實施）
1. ✅ 整數座標系統
2. ✅ 邊界檢查
3. ✅ 像素對齊
4. ✅ 錯誤處理

### 中優先級（後續優化）
5. ⚠️ 性能優化（資源重用）
6. ⚠️ 更詳細的驗證

### 低優先級（可選）
7. 💡 Web Worker 支持
8. 💡 OffscreenCanvas 支持

## 📈 預期改進效果

- **精度**：消除累積誤差，確保所有幀都被正確切分
- **穩定性**：邊界檢查避免錯誤
- **一致性**：整數座標確保跨瀏覽器一致性
- **性能**：資源重用提高 10-20% 性能
