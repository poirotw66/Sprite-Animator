/**
 * Guided-grid prompt blocks for LINE sticker sheet generation.
 * Used when Gemini edits a pre-attached grid template in place.
 */

export function buildGuidedCompactLayoutBlock(
  cols: number,
  rows: number,
  totalFrames: number,
  cellWidthPct: number,
  cellHeightPct: number,
  bgHex: string
): string {
  return `[1. Layout — GUIDED GRID] Square 1:1 canvas with ${cols}×${rows} = ${totalFrames} cells (${cellWidthPct}%×${cellHeightPct}% each).
Edit the provided grid template **in place** — same dimensions, same seam positions.
Place **exactly ONE sticker per cell**. Cell boundaries = template grid grooves.
Keep ~10–15% ${bgHex} margin inside every cell. Do NOT redraw the grid or change layout.`;
}

export function buildGuidedCompactOutputBlock(cols: number, rows: number, totalFrames: number): string {
  return `[7. Output] Edit the provided grid template in place. ${cols}×${rows} = ${totalFrames} cells.
Each sticker fully contained in its cell (row, col). Splittable at template seams.`;
}

export function formatGuidedCompactCellLine(
  index: number,
  cols: number,
  phrase: string,
  action: string,
  includeText: boolean,
  bandSuffix = ''
): string {
  const n = index + 1;
  const row = Math.floor(index / cols) + 1;
  const col = (index % cols) + 1;
  const cellLabel = `Cell ${n} (row ${row}, col ${col})`;
  if (!includeText) {
    return `${cellLabel}: ${action}${bandSuffix}`;
  }
  return `${cellLabel}: "${phrase}" | ${action}`;
}

export function buildGuidedSuffixLayoutBlock(
  cols: number,
  rows: number,
  totalFrames: number,
  includeText: boolean
): string {
  const fillBullet = includeText
    ? `3. **Fill**: In each cell, character and text must occupy the central area (~65–75% of the cell). Keep ~10–15% green margin on all four sides. Forbidden: art crossing cell seams or sitting in gutters.`
    : `3. **Fill**: In each cell, character must occupy the central area (~65–75% of the cell). Keep ~10–15% green margin on all four sides. Do NOT draw any text. Forbidden: art crossing cell seams.`;

  return `
---

### [Output Format — GUIDED GRID EDIT]

1. **Canvas**: The attached grid template is authoritative. Edit it **in place** — do not generate a new layout or relocate seams.
2. **Cell placement (CRITICAL)**: Exactly **${cols} columns × ${rows} rows** = **${totalFrames} stickers**. Place **one subject per cell**, fully inside that cell's boundaries (the faint grid grooves). **Never** cross a seam into a neighboring cell.
3. **Reading order**: Left→right, top→bottom — row 1 cells 1–${cols}, then row 2, … through row ${rows}.
${fillBullet}
4. **Grid lines**: Keep the template's existing faint groove lines intact — they mark exact cell boundaries. Do **not** add white, black, or new divider lines. Do **not** hide or redraw the template grid.
5. **Consistency**: Each row has exactly **${cols}** stickers. Count before output.`;
}
