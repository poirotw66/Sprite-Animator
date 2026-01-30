# Color Normalization Testing Guide

## 測試工具 (Test Tool)

我們提供了一個獨立的 HTML 測試工具來驗證顏色標準化功能。

### 使用方法 (How to Use)

1. **開啟測試工具**
   ```bash
   # 在專案根目錄開啟
   open test-color-normalization.html
   
   # 或使用瀏覽器直接開啟
   # Chrome/Safari/Firefox: File > Open > test-color-normalization.html
   ```

2. **測試 1: 洋紅色變體 (Magenta Variants)**
   - 點擊「Run Magenta Test」按鈕
   - 查看各種洋紅色變體是否能被正確識別
   - ✅ 表示會被標準化為 #FF00FF
   - ❌ 表示不會被標準化

3. **測試 2: 綠幕變體 (Green Screen Variants)**
   - 點擊「Run Green Test」按鈕
   - 查看各種綠色變體是否能被正確識別
   - ✅ 表示會被標準化為 #00B140
   - ❌ 表示不會被標準化

4. **測試 3: 視覺比較 (Visual Comparison)**
   - 上傳一張帶有綠幕或洋紅色背景的圖片
   - 選擇顏色類型（Magenta 或 Green Screen）
   - 點擊「Process Image」按鈕
   - 查看處理前後的對比
   - 檢查統計資訊（修改的像素數量和百分比）

## 測試案例 (Test Cases)

### Magenta (洋紅色)

| Color | RGB | Should Normalize? | Reason |
|-------|-----|-------------------|--------|
| #FF00FF | (255, 0, 255) | ✅ Yes | Target color |
| #FE00FE | (254, 0, 254) | ✅ Yes | Very close to target |
| #FC00FC | (252, 0, 252) | ✅ Yes | Within tolerance |
| #FF10FF | (255, 16, 255) | ✅ Yes | G < 120, magenta-like |
| #F800F8 | (248, 0, 248) | ✅ Yes | Within tolerance |
| #FF69B4 | (255, 105, 180) | ❌ No | Pink (G too high) |
| #800080 | (128, 0, 128) | ❌ No | Purple (R, B too low) |

### Green Screen (綠幕)

| Color | RGB | Should Normalize? | Reason |
|-------|-----|-------------------|--------|
| #00B140 | (0, 177, 64) | ✅ Yes | Target color |
| #00FF00 | (0, 255, 0) | ✅ Yes | Lime green, green-like |
| #00C850 | (0, 200, 80) | ✅ Yes | Close to target |
| #10B145 | (16, 177, 69) | ✅ Yes | Within tolerance |
| #00A030 | (0, 160, 48) | ✅ Yes | Green-like |
| #228B22 | (34, 139, 34) | ⚠️ Maybe | Forest green (borderline) |
| #32CD32 | (50, 205, 50) | ❌ No | Lime green (R too high) |

## 驗證標準 (Validation Criteria)

### 成功標準 (Success Criteria)

1. **精確度 (Accuracy)**
   - 所有目標色的變體都應被正確識別
   - 非目標色（如 pink, purple）不應被誤判

2. **覆蓋率 (Coverage)**
   - 至少 95% 的背景像素應被標準化
   - 角色像素不應被誤判為背景

3. **效能 (Performance)**
   - 處理時間應在 500ms 以內（1920x1080 圖片）
   - 記憶體使用合理（無洩漏）

4. **視覺效果 (Visual Quality)**
   - 標準化後的背景應為純色
   - 角色邊緣應清晰，無色邊
   - 抗鋸齒效果應保留

## 實際測試流程 (Real-World Testing)

### 步驟 1: 生成測試圖片

使用 Gemini API 生成帶有綠幕/洋紅色背景的精靈圖:

```typescript
const spriteSheet = await generateSpriteSheet(
  base64Image,
  "Run Cycle",
  4,
  4,
  apiKey,
  "gemini-2.5-flash-image",
  (status) => console.log(status),
  'green' // or 'magenta'
);
```

### 步驟 2: 檢查進度訊息

確認看到「正在標準化背景顏色...」的訊息。

### 步驟 3: 驗證去背效果

1. 下載處理後的精靈圖
2. 在圖片編輯軟體中開啟
3. 使用顏色選擇器檢查背景顏色
4. 確認背景為精確的 #FF00FF 或 #00B140

### 步驟 4: 測試去背

1. 在應用中開啟精靈圖
2. 確認「去背」選項已開啟
3. 檢查預覽效果
4. 導出動畫並檢查透明度

## 已知限制 (Known Limitations)

1. **邊緣情況 (Edge Cases)**
   - 非常暗的綠色（G < 80）可能不會被識別
   - 非常亮的粉紅色（G > 120）可能不會被識別為洋紅色

2. **效能 (Performance)**
   - 超大圖片（> 4K）可能需要較長處理時間
   - 建議在生成時使用合理的圖片尺寸

3. **顏色空間 (Color Space)**
   - 目前僅支援 sRGB 顏色空間
   - 不支援 CMYK 或其他顏色空間

## 故障排除 (Troubleshooting)

### 問題 1: 背景沒有被標準化

**可能原因**:
- AI 生成的顏色與目標色差異太大
- 圖片格式不支援（應使用 PNG）

**解決方案**:
- 檢查 AI 生成的實際顏色
- 調整 `tolerance` 參數（目前為 80）
- 增強 AI 提示詞

### 問題 2: 角色被誤判為背景

**可能原因**:
- 角色顏色與背景色太接近
- 檢測邏輯太寬鬆

**解決方案**:
- 避免使用與背景色相近的角色
- 調整檢測邏輯的閾值
- 使用對比度更高的背景色

### 問題 3: 處理速度太慢

**可能原因**:
- 圖片尺寸太大
- 瀏覽器效能限制

**解決方案**:
- 減小圖片尺寸
- 使用現代瀏覽器（Chrome/Edge）
- 考慮使用 Web Worker 處理

## 相關文件 (Related Documents)

- [Background Color Normalization Technical Doc](./BACKGROUND_COLOR_NORMALIZATION.md)
- [Changelog](./CHANGELOG_COLOR_NORMALIZATION.md)
- [Chroma Key Improvement](./CHROMA_KEY_IMPROVEMENT.md)

---

**最後更新**: 2026-01-30  
**版本**: v1.2.0
