# 精靈圖切分與校正流程（目前實作）

本文說明專案**目前**從精靈圖（sprite sheet）到最終每一幀圖片的完整流程，方便對照你期望的正確流程。

---

## 1. 精靈圖來源與前處理

- **輸入**：使用者上傳一張精靈圖（或由 Gemini 生成），存成 `spriteSheetImage`（Base64）。
- **Chroma key 去背**（`useSpriteSheet` + `chromaKeyWorker`）  
  - 依設定的顏色（magenta/green）與 fuzz 去除背景。  
  - 結果存成 `processedSpriteSheet`。  
- **格線設定**（`sliceSettings`）：  
  - 欄/列數（cols, rows）、padding（或四邊 padding）、shift（shiftX, shiftY）。  
  - 若為「推論格線」模式（`sliceMode === 'inferred'`），會使用 `inferredCellRects`，不走底下的「固定格線 + 每格校正」。

---

## 2. 格線與「每格切割框」怎麼算

- **固定格線**（非 inferred）：  
  - 用 `getCellRectForFrame(sheetWidth, sheetHeight, cols, rows, padding, shift, frameIndex)` 算出**每一格在整張圖上的矩形** `(x, y, width, height)`。  
  - 每一格大小相同：`cellWidth = (sheetWidth - padding) / cols`，`cellHeight` 同理。  
- **每格的「切割框」**（crop box）在 `sliceSpriteSheet` 裡：  
  - 先有「格子的左上角」`(baseSx, baseSy)`。  
  - 再套用**該幀的 frameOverride**：`scale`、`offsetX`、`offsetY`。  
  - 切割框 = 以格子中心為基準，先縮放（scale）再平移（offsetX, offsetY）：  
    - `cropW = cellWidth * scale`, `cropH = cellHeight * scale`  
    - `sx = baseSx + (cellWidth - cropW)/2 + offsetX`  
    - `sy = baseSy + (cellHeight - cropH)/2 + offsetY`  
  - 用這個 `(sx, sy, cropW, cropH)` 從精靈圖取樣，畫到固定尺寸的輸出幀（`frameWidth x frameHeight`，即整數化的 cell 尺寸）。

也就是說：**每一幀的「校正」就是該幀的 `frameOverrides[i]`（offsetX, offsetY, scale）**；切分時已經用這些值去決定從精靈圖的哪裡、裁多大。

---

## 3. frameOverrides 的來源與時機

- **初始值**：`frameOverrides = []`。  
  - 切分時若 `frameOverrides[i]` 不存在，該幀視為 `offsetX=0, offsetY=0, scale=1`，即「格子中心、格子整格大小」。
- **何時被清空**：  
  - 當 `processedSpriteSheet` 或格線（cols/rows）改變時，會 `setFrameOverrides([])`，並允許之後再跑一次「智能對齊」。
- **何時被寫入**：  
  1. **自動智能對齊（僅在「有 autoOptimized」時）**（`useSpriteSheet` 內）：  
     - 條件：`sliceSettings.autoOptimized` 存在（通常是 **Gemini 生成精靈圖後** 自動推的 padding/shift）。  
     - 條件還包含：`processedSpriteSheet`、`generatedFrames.length > 0`、`sheetDimensions` 都有值。  
     - 會呼叫 `smartAutoAlignFrames(..., { alignMode: 'core', anchorFrame: 0, lockAllFramesToAnchor: true, ... })`，得到每幀的 `(offsetX, offsetY)`，再 `setFrameOverrides(offsets.map(o => ({ ...o, scale: 1 })))`。  
     - **若沒有 autoOptimized**（例如手動上傳精靈圖、手動設格線），這段**不會跑**，`frameOverrides` 會一直維持 `[]`。  
  2. **手動「以錨點重新對齊」**（動作分解視窗內）：  
     - 使用者按「✨ 以錨點重新對齊」時，採用 **逐幀參考上一幀圖片** 的演算法（chain-to-previous）：  
       - **第 0 幀**：錨點。使用目前 `frameOverrides[0]`（若無則用 `getContentCentroidOffset` 將軀幹置中於格內）。  
       - **第 i 幀（i ≥ 1）**：以 **第 i−1 幀的裁切圖**（用已算出的 offset[i−1]、scale 從精靈圖裁出）當參考圖，對第 i 幀的格做 **template matching**（`getBestOffsetByTemplateMatch`），搜尋 ±50 px，得到 (offsetX_i, offsetY_i)。  
     - 結果是每一幀的裁切都對齊到「上一幀的裁切圖」，主體軀幹在疊圖時無偏移。  
  3. **手動「從第一幀套用至其餘」**：  
     - 把 `frameOverrides[0]` 複製到所有幀。  
  4. **手動逐幀編輯**：  
     - 在「編輯第 N 幀」裡改 X/Y/scale，只更新 `frameOverrides[N]`。

---

## 4. 切分觸發時機（何時用 frameOverrides 重切）

- **Re-slice 的 useEffect**（`useSpriteSheet`）：  
  - 依賴：`processedSpriteSheet`、`sliceSettings`（含 cols, rows, padding, shift, sliceMode, inferredCellRects）、**`frameOverrides`**、mode。  
- 流程：  
  1. Chroma key 完成 → `processedSpriteSheet` 更新。  
  2. 另一 effect 因 `processedSpriteSheet` / cols / rows 改變而 **清空** `frameOverrides`。  
  3. Re-slice 跑第一次：此時 `frameOverrides` 為 `[]`，所以每一幀都是「格子中心、無偏移、scale 1」→ 得到一組 `generatedFrames`。  
  4. 若有 autoOptimized，智能對齊跑完 → `setFrameOverrides(...)`。  
  5. `frameOverrides` 改變 → Re-slice 再跑一次，這次用新的 overrides 切分 → 使用者看到的才是「對齊後」的幀。

若**沒有** autoOptimized（例如手動上傳圖），就不會有步驟 4，`frameOverrides` 一直是 `[]`，從頭到尾都是「每格正中心、無校正」的切分。

---

## 5. 智能對齊演算法（smartAutoAlignFrames）在做什麼

- **輸入**：精靈圖 Base64、每格的 `cellRects`、選項（alignMode、anchorFrame、anchorOffset、lockAllFramesToAnchor、temporalSmoothing 等）。  
- **步驟概要**：  
  1. 對**每一格**呼叫 `analyzeFrameContent(sheet, cellRect)`：  
     - 在該格內做像素掃描（排除 chroma key），算 bounding box、質心、以及「軀幹帶」內像素的 median（core center）。  
     - 軀幹帶：格子內水平 42%–58%、垂直 30%–70%，再做離群值剔除。  
  2. 以 **anchor 幀**（預設第 0 幀）的參考點（依 alignMode 用 core / mass / bounds）為基準。  
  3. 若沒給 `anchorOffset`，則用「讓 anchor 幀的參考點落在格子中心」的 offset 當錨點 offset。  
  4. 對其餘幀算出「若要把該幀的參考點對到錨點，需要的 (offsetX, offsetY)」。  
  5. 若 `lockAllFramesToAnchor === true`：**全部幀強制用同一個錨點 offset**（無幀間偏移）。  
  6. 再做時間平滑、與「相鄰幀最大位移」限制，最後回傳每幀的 `(offsetX, offsetY)`。

這些 offset 不會改精靈圖本身，只會寫進 `frameOverrides`，下次 re-slice 時用來決定每格從哪裡裁。

---

## 6. 流程總覽（簡表）

| 步驟 | 誰做 | 結果 |
|------|------|------|
| 1. 精靈圖 | 上傳 / Gemini | `spriteSheetImage` |
| 2. 去背 | chromaKeyWorker | `processedSpriteSheet` |
| 3. 格線 | sliceSettings（或 inferred） | 每格 `cellRect` |
| 4. frameOverrides 初始 | 清空 effect | `[]` |
| 5. 第一次切分 | re-slice（frameOverrides=[]） | 每格中心、無校正 → `generatedFrames` |
| 6. 智能對齊（條件滿足時） | smartAutoAlignFrames → setFrameOverrides | 每幀 (offsetX, offsetY)（或全部同錨點） |
| 7. 第二次切分 | re-slice（frameOverrides 有值） | 用 overrides 裁切 → 使用者看到的幀 |
| 8. 之後手動改 | 編輯單幀 / 從第一幀套用 / 再按「以錨點重新對齊」 | frameOverrides 更新 → 再觸發 re-slice |

**重要**：  
- 只有「有 autoOptimized」時，步驟 6 才會自動跑；手動上傳精靈圖時，目前不會自動跑智能對齊。  
- 你看到的「每一 frame 都有一點偏移」，可能是：  
  - 自動對齊沒跑（沒 autoOptimized），或  
  - 自動對齊有跑但用的是「每幀各自對齊」的舊邏輯，或  
  - 你期望的是「先定一個共同軀幹中心，再讓每幀都對齊到同一點」，而目前流程與選項和這個期望不一致。

---

接下來可以請你說明：**你理想中的正確流程**（例如：先定錨點、再切分、還是先切分再統一對齊到哪一點等），我可以對照這份文件幫你對齊成實作方案或調整現有邏輯。
