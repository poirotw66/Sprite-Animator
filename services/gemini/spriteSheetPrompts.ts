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
 * When includeText is false, layout wording avoids "text" and a strict no-text block is appended.
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
    /** When false, no text/labels in image; layout and a strict no-text rule are applied. */
    includeText?: boolean;
  }
): string {
  const {
    cols,
    rows,
    totalFrames,
    bgColorHex,
    bgColorRGB,
    chromaKeyColor,
    includeText = true,
  } = opts;

  const bgColorRequirement = `
---

### [Background Color — CRITICAL]

The background MUST be a solid color **${bgColorHex}** (${bgColorRGB}) for chroma key removal. No scenery, gradients, shadows, or other background elements.

${chromaKeyColor === 'magenta'
    ? `⚠️ MAGENTA REQUIREMENT:
  • R = 255, G = 0, B = 255
  • Must be pure magenta #FF00FF, not pink or purple.

⚠️ Chroma-key friendly (avoid text-edge residue):
  • Do NOT use magenta, pink, purple, or any color close to #FF00FF for text, character outlines, or shadows.
  • Use only black, white, or dark colors that contrast with magenta (e.g. dark gray, navy, dark brown) so that after keying there is no magenta bleed on text edges.`
    : `⚠️ GREEN SCREEN REQUIREMENT:
  • R = 0, G = 177, B = 64
  • Must be standard green screen #00B140, not cyan or grass green.`}

Every background pixel MUST be EXACTLY ${bgColorHex}.
`;

  // When includeText is false, do not mention "text" in layout so the model is not encouraged to draw text
  const fillBullet = includeText
    ? `3. **Fill**: In each cell, character and text must occupy most of the area (character ~70–85% of cell height). Minimal internal padding only. Forbidden: tiny character with large empty space around.`
    : `3. **Fill**: In each cell, character must occupy most of the area (character ~70–85% of cell height). Minimal internal padding only. Forbidden: tiny character with large empty space. Do NOT draw any text, numbers, or labels in the image.`;

  const layoutEnforcement = `
---

### [Output Format — MUST FOLLOW]

1. **Grid**: The image must be exactly divisible into **${cols} columns × ${rows} rows**, **${totalFrames} cells** total. Left to right, top to bottom; equal size per cell. No outer margins, no gaps or lines between cells.
2. **No frame or white lines**: Do NOT draw any frame lines, grid lines, borders, separators, or cell outlines. No white frame lines, white separators, or white grid lines between cells. Where two cells meet, both sides must be the same background color with no visible white gap or line. Cells must visually form one continuous background.
${fillBullet}
4. **Consistency**: All cells must have the same size and alignment so the image can be split into ${cols}×${rows} independent stickers at fixed ratios.
`;

  const noTextBlock =
    !includeText
      ? `

### [No Text — CRITICAL]

* **DO NOT** draw any text, letters, numbers, words, labels, or captions in any cell.
* Only character poses and expressions. The image must be completely free of written text.
* If the prompt above mentions "phrase" or "text", treat it as theme/expression only — do not render any text in the image.
`
      : '';

  return prompt + bgColorRequirement + layoutEnforcement + noTextBlock;
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
* **Gaps**: No gaps between cells. Adjacent cells share the same boundary. Do NOT draw any dividers, borders, frame lines, or grid lines between or around cells.
* **Forbidden**: No visible frame lines, grid lines, borders, or separators anywhere. The grid is invisible—only the background color fills the space.
* **No white separator lines**: Do NOT draw any white lines, white strips, or white borders between cells. Where one cell meets the next, both sides must be the same background color (${bgColorHex}) with no visible white gap, white rule, or white divider. The boundary between two cells must be invisible—same color on both sides.
* **Output**: The image MUST be perfectly splittable into ${totalFrames} equal rectangles.
* **Per cell**: Character must occupy ~70–85% of cell height. Do NOT draw a box, frame, or border around each cell. Minimum internal padding ~5–10%. Character must NOT cross grid lines or touch adjacent cells. One independent pose per cell.

### [2. Style / Art Medium]

* **Lighting (technical)**: Flat shading only. No drop shadows, no gradients, no ambient occlusion. Sharp edges against background.
* **No frame lines or grid separators**: Do NOT draw any line, frame, border, box, or divider between cells or around the image or around each pose. The grid is logical only (for splitting later); adjacent cells must share the same background with zero visible lines. No white lines between cells—same background color on both sides of every cell edge.

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

Output a single image: ${cols}×${rows} grid, ${totalFrames} equal rectangles. Splittable at exactly ${cellWidthPct}% width and ${cellHeightPct}% height per cell. CRITICAL: No visible frame lines, borders, grid lines, or separator lines—one continuous background only. One pose per cell with minimal change between cells. Do not draw any frame or line between or around cells.

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
