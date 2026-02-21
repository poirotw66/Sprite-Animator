/**
 * Builds full prompts for sprite sheet generation (LINE sticker vs animation).
 */

import type { ChromaKeyColorType } from '../../types';

export function isLineStickerPrompt(prompt: string): boolean {
  return (
    prompt.includes('LINE 貼圖') ||
    prompt.includes('LINE sticker') ||
    prompt.includes('表情貼圖') ||
    prompt.includes('每一格的具體分配')
  );
}

/**
 * Builds background color + layout suffix for LINE sticker mode.
 */
export function buildLineStickerPromptSuffix(
  prompt: string,
  opts: {
    cols: number;
    rows: number;
    totalFrames: number;
    bgColorHex: string;
    bgColorRGB: string;
    chromaKeyColor: ChromaKeyColorType;
  }
): string {
  const {
    cols,
    rows,
    totalFrames,
    bgColorHex,
    bgColorRGB,
    chromaKeyColor,
  } = opts;

  const bgColorRequirement = `
---

### 【背景顏色要求（CRITICAL）】

背景必須是純色 **${bgColorHex}**（${bgColorRGB}），用於後續去背處理。
不得出現場景、漸變、陰影或其他背景元素。

${chromaKeyColor === 'magenta'
    ? `⚠️ MAGENTA REQUIREMENT:
  • R = 255, G = 0, B = 255
  • 必須是純洋紅色 #FF00FF，不是粉色或紫色

⚠️ 去背友善（避免文字處殘留）：
  • 文字與角色輪廓、陰影**禁止使用**洋紅、粉紅、紫色或任何接近 #FF00FF 的顏色
  • 僅使用黑色、白色或與洋紅對比明顯的深色（如深灰、深藍、深棕），避免去背後在文字邊緣產生洋紅殘留`
    : `⚠️ GREEN SCREEN REQUIREMENT:
  • R = 0, G = 177, B = 64
  • 必須是標準綠幕 #00B140，不是青綠色或草綠色`}

背景的每個像素都必須是 EXACTLY ${bgColorHex}。
`;

  const layoutEnforcement = `
---

### 【輸出格式強制（OUTPUT FORMAT - MUST FOLLOW）】

1. **網格**：整張圖必須可被精確均分為 **${cols} 欄 × ${rows} 列**，共 **${totalFrames} 格**。從左到右、從上到下每格等大，無外圍留白、無格與格之間的縫隙或線條。
2. **禁止框線與白線**：不得繪製任何 框線、格線、邊框、分隔線 或 格子外框。格與格之間不得出現任何白色框線、白色分隔線或白色格線；相鄰兩格交界處必須是同一片背景色，不能有一條白色縫隙或白線把兩格分開。格子與格子之間視覺上連成一片背景。
3. **填滿**：每一格內角色與文字需佔滿大部分面積（角色約佔格高 70%～85%），單格內僅保留極少內邊距，禁止「角色很小、周圍一大片空白」的構圖。
4. **一致性**：所有格子的尺寸與對齊方式必須一致，使後續可依固定比例裁成 ${cols}×${rows} 張獨立貼圖。
`;

  return prompt + bgColorRequirement + layoutEnforcement;
}

/**
 * Builds the full animation sprite sheet prompt (non-LINE).
 */
export function buildAnimationSpriteSheetPrompt(
  prompt: string,
  opts: {
    cols: number;
    rows: number;
    totalFrames: number;
    bgColorHex: string;
    bgColorRGB: string;
    chromaKeyColor: ChromaKeyColorType;
  }
): string {
  const {
    cols,
    rows,
    totalFrames,
    bgColorHex,
    bgColorRGB,
    chromaKeyColor,
  } = opts;

  const cellWidthPct = Math.round(100 / cols);
  const cellHeightPct = Math.round(100 / rows);
  const cellDescriptions = Array.from({ length: totalFrames }, (_, i) => {
    const progress = i / totalFrames;
    const degrees = Math.round((progress * 360 / totalFrames) * 10) / 10;
    const row = Math.floor(i / cols) + 1;
    const col = (i % cols) + 1;
    return `**Cell ${i + 1} (row ${row}, col ${col})**: Action: "${prompt}" | ${degrees}° into motion cycle. TINY change from previous cell.`;
  }).join('\n');

  const bgColorNameExact =
    chromaKeyColor === 'magenta' ? 'Pure Magenta #FF00FF' : 'Neon Green #00FF00';

  return `
🎨 Character Animation Sprite Sheet Generation

### [1. Global Layout] CRITICAL

* **Canvas**: Grid aspect ${cols}×${rows}. High resolution output. No letterboxing—image edges = grid boundaries.
* **Grid**: ${cols}×${rows} = ${totalFrames} cells. Each cell exactly **${cellWidthPct}% of image width** and **${cellHeightPct}% of image height**.
* **Margins**: None. No empty space at left, right, top, or bottom.
* **Gaps**: No gaps between cells. Adjacent cells share the same boundary. Do NOT draw any dividers, borders, frame lines (框線), or grid lines (格線) between or around cells.
* **Forbidden**: No visible 框線, 格線, 邊框, or 分隔線 anywhere. The grid is invisible—only the background color fills the space.
* **No white separator lines**: Do NOT draw any white lines, white strips, or white borders between cells. Where one cell meets the next, both sides must be the same background color (${bgColorHex}) with no visible white gap, white rule, or white divider. The boundary between two cells must be invisible—same color on both sides.
* **Output**: The image MUST be perfectly splittable into ${totalFrames} equal rectangles.
* **Per cell**: Character must occupy ~70–85% of cell height. Do NOT draw a box, frame, or border around each cell. Minimum internal padding ~5–10%. Character must NOT cross grid lines or touch adjacent cells. One independent pose per cell.

### [2. Style / Art Medium]

* **Lighting (technical)**: Flat shading only. No drop shadows, no gradients, no ambient occlusion. Sharp edges against background.
* **No 框線 or grid separators**: Do NOT draw any line, frame, border, box, or divider between cells or around the image or around each pose. The grid is logical only (for splitting later); adjacent cells must share the same background with zero visible lines. No white lines between cells—same background color on both sides of every cell edge.

### [3. Subject / Character] CRITICAL — Image is primary

* **Primary reference**: The **uploaded image is the main source**. Draw **this exact character**: same face, hair, outfit, color palette, proportions, and recognisable features. Do not replace them with a generic character.
* **Consistency**: Invariants = face proportions, skin tone, hair silhouette, main outfit, color scheme. Variants = pose, expression, limb positions only (micro changes between cells).

### [4. Lighting & Background] CRITICAL

* **Background color (exact)**: The entire canvas must be **exactly ${bgColorNameExact}** (hex ${bgColorHex}). Every cell must use this same color—no gradients, no pink/purple/green variants (e.g. do NOT use #E91E63 or similar). One single RGB value for all background pixels so that chroma key removal works uniformly.
* **Lighting**: No shadows. Flat shading only. Ambient occlusion disabled.
* **Uniform**: Same color across the entire sprite sheet. No ground, clouds, or decorative elements. Character edges must be sharp and clean against the background.
* Do NOT use similar colors—ONLY the EXACT hex ${bgColorHex} (${bgColorRGB}). Every background pixel MUST be this value.

### [5. Task & Motion]

Action: "${prompt}"
Layout: ${totalFrames} poses in a ${cols}×${rows} grid (left→right, top→bottom). Order: row by row, each cell exactly ${cellWidthPct}% width × ${cellHeightPct}% height.

**THE MOST IMPORTANT RULE**: Imagine recording a video at ${totalFrames * 4} FPS, then keeping only every 4th frame. Each cell should look almost IDENTICAL to its neighbors. The difference between one cell and the next should be BARELY NOTICEABLE. If someone quickly glances at all ${totalFrames} cells, they should think: "These all look almost the same—just tiny differences." This is CORRECT for smooth animation.

**Grid Content — Per Cell** (do NOT draw cell numbers, numerals, or labels on the image):
${cellDescriptions}

Between ANY two consecutive cells:
• Limbs rotate by only ~${Math.max(3, Math.round(15 / totalFrames))}° to ${Math.max(5, Math.round(25 / totalFrames))}° MAX
• Body shifts by only ~${Math.max(1, Math.round(5 / totalFrames))}% to ${Math.max(2, Math.round(8 / totalFrames))}% of height MAX
• Head tilts by only ~${Math.max(1, Math.round(5 / totalFrames))}° to ${Math.max(2, Math.round(8 / totalFrames))}° MAX
• Facial expression: NO change or microscopic change only
(THESE ARE MAXIMUM VALUES—smaller is better.)

Onion skin test: Overlaying the first and second cell at 50% opacity should look like ONE slightly blurry figure, not two separate poses. Overlaying all ${totalFrames} cells should look like ONE character with motion blur.

For "${prompt}": arm swing per cell ~${Math.round(45 / totalFrames)}°; body bob per cell ~${Math.round(10 / totalFrames)}%; foot movement per cell ~${Math.round(15 / totalFrames)}%. Think: "Is this change small enough to be smooth at 12 FPS?"

Perfect loop: The last cell (bottom-right) → first cell (top-left) must have the SAME tiny difference as any other adjacent pair. The animation is a CIRCLE; the last cell flows INTO the first cell.

Character anchor (fixed across all cells): foot/ground contact Y, overall size, center position per cell, art style and proportions.

Common mistakes to avoid: Do not make each cell a "key pose"; make tiny increments like video frames. Do not show the full action range in one step—show 1/${totalFrames}th of the action per cell.

### [6. Final Goal]

Output a single image: ${cols}×${rows} grid, ${totalFrames} equal rectangles. Splittable at exactly ${cellWidthPct}% width and ${cellHeightPct}% height per cell. CRITICAL: No visible 框線, borders, grid lines, or separator lines—one continuous background only. One pose per cell with minimal change between cells. Do not draw any frame or line between or around cells.

### [7. Forbidden]

• NO frame numbers, cell numbers, numerals (1, 2, 3...), or text labels drawn on the image—the grid has no visible labels.
• NO borders, frames, grid lines, dividers, rectangles, or boxes around or between cells.
• NO white lines, white strips, or white dividers between cells—same background color on both sides of every cell boundary.
• NO ground line, floor line, baseline, shadow, platform, or surface under the character.
• NO horizontal or vertical lines of any color anywhere.
• NO color variations in background—ONLY EXACTLY ${bgColorHex}. No gradients.
• Background MUST be exactly ${bgColorHex} (${bgColorRGB}); any other shade will break chroma key removal.

Generate the sprite sheet with MINIMAL frame-to-frame variation.
`;
}
