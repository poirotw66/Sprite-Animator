# 角色動畫小工具 — 參考 LINE 貼圖 prompt 的可修改項目

以下對照 **LINE 貼圖製作工具** 的 prompt 結構，條列角色動畫 prompt **可考慮的修改**。每項皆可獨立決定是否採用。

---

## LINE 貼圖 prompt 結構摘要

| 順序 | 區塊 | 內容要點 |
|------|------|----------|
| 0 | 開頭 | `🎨 LINE Sticker Sprite Sheet Generation` |
| 1 | [1. Global Layout] CRITICAL | 網格、每格 X%×Y%、無留白、無框線、可精確裁切、每格 70–85%、不跨界 |
| 2 | [2. Style / Art Medium] | 風格、技法、平塗無陰影、白邊、再次強調無框線 |
| 3 | [3. Subject / Character] | 以**上傳圖為主**、風格為輔、一致性（不變項 vs 可變項） |
| 4 | [4. Lighting & Background] CRITICAL | 精確 hex、平塗、整張同色、無地面/雲/裝飾 |
| 5 | [5. Grid Content — Per Cell] | 每格一行：`**Cell N (row R, col C)**: Text / Action` |
| 6 | [6. Text Setting] | 語言/字體/顏色 或 「禁止文字」 |
| 7 | [7. Final Goal] | 一句總結：perfect square、N 個等大矩形、splittable at X%×Y%、no 框線 |
| + | geminiService 追加 | 【背景顏色要求】+ 【輸出格式強制】中文 |

---

## 可修改項目（由你決定是否採用）

### 1. 開頭加一句總述（與 LINE 一致）

- **LINE**：`🎨 LINE Sticker Sprite Sheet Generation`
- **角色動畫目前**：直接進入 `You are creating a sprite sheet for ULTRA-SMOOTH looping animation.`
- **建議**：在全文最開頭加一行  
  `🎨 Character Animation Sprite Sheet Generation`  
  讓模型先辨識「這是精靈圖生成」再讀細節。
- **影響**：結構與 LINE 對齊，可能略增任務辨識度。

---

### 2. 章節改為 `### [N. 名稱]` 格式（與 LINE 一致）

- **LINE**：`### [1. Global Layout] CRITICAL`、`### [2. Style / Art Medium]` …
- **角色動畫目前**：`══════════ BACKGROUND (EXACT) ══════════`、全大寫標題等。
- **建議**：改為編號區塊，例如  
  `### [1. Background] CRITICAL`、`### [2. Global Layout] CRITICAL`、`### [3. Task & Motion]` …  
  最後保留 `### [N. Final Goal]`。
- **影響**：與 LINE 同一套標題體系，方便模型解析層級；若你偏好現有視覺風格可保留不改。

---

### 3. 在 Layout 區塊補上 Canvas 說明（與 LINE 一致）

- **LINE**：`* **Canvas**: Perfect square (1:1 aspect ratio). High resolution output.`
- **角色動畫目前**：未明確寫 canvas 比例（實際由 `targetAspectRatio` 控制）。
- **建議**：在 [Global Layout] 第一條補上，例如  
  `* **Canvas**: Aspect ratio ${cols}:${rows} (or 1:1 when square). High resolution output.`  
  或若一律用 getBestAspectRatio 結果，可寫成「依網格比例輸出，無留白」。
- **影響**：與 LINE 一樣有明確「畫布」描述，有助輸出尺寸/比例穩定。

---

### 4. 新增 [Style / Art Medium] 區塊（可選）

- **LINE**：有 [2. Style]、Lighting (technical)、「無框線」再提醒一次。
- **角色動畫目前**：沒有獨立的 Style 區塊，僅在禁止項裡提到線條/框線。
- **建議**：新增一小段，例如  
  `### [Style] (match reference image)`  
  `* **Lighting**: Flat shading only. No drop shadows, no gradients. Sharp edges against background.`  
  `* **No 框線 or grid separators**: Do NOT draw any line, frame, or border between cells.`  
  不強制改畫風，只強調「平塗、無陰影、無格線」。
- **影響**：與 LINE 一樣有「技法/光影」約束，可能減少陰影與框線。

---

### 5. 新增 [Subject / Character] 區塊（可選）

- **LINE**：有 [3. Subject]、Primary reference = 上傳圖、Style hint 輕微、Consistency（不變項 vs 可變項）。
- **角色動畫目前**：沒有「以參考圖為主」的獨立區塊，僅在 TASK 提到 Action。
- **建議**：新增短區塊，例如  
  `### [Subject / Character]`  
  `* **Primary reference**: The uploaded image is the main source. Draw this exact character: same face, hair, outfit, colors, proportions.`  
  `* **Consistency**: Invariants = proportions, outfit, color scheme. Variants = pose, expression, limb positions only.`  
  避免模型把角色畫成別人。
- **影響**：角色一致性可能提升；若你覺得目前已經夠用可不加。

---

### 6. Per-cell 列表格式改為更接近 LINE 的 [5. Grid Content]

- **LINE**：`**Cell 1 (row 1, col 1)**: Text: "..." | Action: ...`，每格一行、含 row/col。
- **角色動畫目前**：`Cell (1,1): 0° into the motion cycle (TINY change from previous cell)`。
- **建議**：可改成類似  
  `**Cell 1 (row 1, col 1)**: 0° into motion cycle. Action: "${prompt}". TINY change from previous cell.`  
  並保留「do NOT draw cell numbers on image」。
- **影響**：與 LINE 的「每格一行、row/col 明確」一致，分格邏輯更清晰；若擔心誘發畫編號可維持現狀。

---

### 7. 結尾加一段 [Final Goal] 一句總結（與 LINE [7] 一致）

- **LINE**：`Output a single image: perfect square, N equal rectangles (C×R). Each rectangle = one LINE sticker. Splittable at exactly X% width and Y% height per cell. CRITICAL: No visible 框線…`
- **角色動畫目前**：FINAL OUTPUT REQUIREMENTS 為多條 bullet，沒有「一句總結」。
- **建議**：在 FINAL OUTPUT 或 ABSOLUTELY FORBIDDEN 之後加一段，例如  
  `### [Final Goal]`  
  `Output a single image: ${cols}×${rows} grid, ${totalFrames} equal rectangles. Splittable at exactly ${cellWidthPct}% width and ${cellHeightPct}% height per cell. No visible 框線, borders, or grid lines—one continuous background. One pose per cell, minimal change between cells.`  
  與 LINE 的 [7] 同風格。
- **影響**：結尾與 LINE 一致，強化「可精確裁切、無框線」的記憶點。

---

### 8. 精簡重複的背景色說明

- **LINE**：在 [4. Lighting & Background] 寫一次；geminiService 再追加一段中文【背景顏色要求】。
- **角色動畫目前**：BACKGROUND 區塊寫一次，後面還有 MAGENTA/GREEN 短句、ABSOLUTELY FORBIDDEN 多條、BACKGROUND COLOR IS CRITICAL、paint bucket、FLOAT 等重複內容。
- **建議**：保留「精確 hex + 禁止變體」的核心，其餘合併或縮短為 1～2 句，例如只保留「Every background pixel MUST be EXACTLY ${bgColorHex}. No gradients.」與一句「Do not use similar colors.」避免重複三、四次。
- **影響**：prompt 變短、邏輯更清楚，同時保留背景色約束。

---

### 9. 角色動畫是否也在 geminiService 追加中文「輸出格式強制」

- **LINE**：在 `fullPrompt = prompt + bgColorRequirement + layoutEnforcement` 時會加【輸出格式強制】中文（網格、禁止框線、填滿、一致性）。
- **角色動畫目前**：僅英文 prompt，沒有在 geminiService 再追加中文。
- **建議**：可選為角色動畫**也**追加同一套（或精簡版）【輸出格式強制】，例如  
  `1. 網格：整張圖可精確均分為 ${cols} 欄 × ${rows} 列…`  
  `2. 禁止框線…`  
  `3. 每格角色佔 70–85%…`  
  與 LINE 共用同一段或稍作改寫。
- **影響**：若模型對中文格式描述反應更好，有助分格與無框線；若以英文為主可維持不加。

---

### 10. 區塊順序改為「Layout 最先」（與 LINE 一致）

- **LINE**：順序為 [1] Layout → [2] Style → [3] Subject → [4] Background → [5] Per-cell → [6] Text → [7] Final。
- **角色動畫目前**：Background → Global Layout → 動畫規則（THE MOST IMPORTANT RULE、TASK、CELL-BY-CELL…）→ FINAL → FORBIDDEN。
- **建議**：可改為 **Layout 最先**，再 Background，再動畫專用規則，最後 Final + Forbidden，例如  
  `[1. Global Layout]` → `[2. Background]` → `[3. Task & Motion]` → … → `[N. Final Goal]` + 禁止項。
- **影響**：與 LINE 的「先分格、再風格/角色、再背景、再每格內容」一致，可能有利模型先建立「網格」再填內容。

---

## 總結表（方便勾選）

| # | 項目 | 目的 | 建議 |
|---|------|------|------|
| 1 | 開頭加 `🎨 Character Animation Sprite Sheet Generation` | 與 LINE 一致、任務辨識 | 可選 |
| 2 | 章節改為 `### [N. 名稱]` | 與 LINE 結構一致 | 可選 |
| 3 | Layout 補上 Canvas 說明 | 比例/解析度明確 | 可選 |
| 4 | 新增 [Style / Art Medium] | 平塗、無陰影、無框線再提醒 | 可選 |
| 5 | 新增 [Subject / Character] | 以圖為主、角色一致 | 可選 |
| 6 | Per-cell 格式改為 LINE 風格（含 row/col、Action） | 分格描述一致 | 可選（注意勿誘發畫編號） |
| 7 | 結尾加 [Final Goal] 一句總結 | 與 LINE [7] 一致 | 建議 |
| 8 | 精簡重複背景色說明 | 簡短、不重複 | 建議 |
| 9 | geminiService 為角色動畫追加中文輸出格式強制 | 分格/無框線雙語強化 | 可選 |
| 10 | 順序改為 Layout 最先 | 與 LINE 閱讀順序一致 | 可選 |

以上皆為「可修改」建議，你可依需求勾選要實作的項目，再告訴我要實作哪幾項即可。
