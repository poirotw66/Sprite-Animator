# Generation prompt

Replace the angle-bracket input slots with the selected reference and all 20
phrase/action pairs before generation. Keep the caption text verbatim. Internal
row/column labels explain layout and must never appear in the image.

```text
Generate exactly ONE LINE sticker sprite sheet as a PNG with genuine alpha transparency.
Use the supplied character reference: <reference identity and observed visual traits>.
Preserve the character's silhouette, markings, palette, proportions, and drawing style.

LAYOUT — REQUIRED
Exactly 4 columns × 5 rows, 20 independent sticker workspaces.
Overall aspect ratio: exactly 37:40 (width:height).
Recommended working resolution: 2960 × 3200 pixels.
At that resolution each cell is exactly 740 × 640 pixels, the same ratio as a 370 × 320 final sticker.
All cells have equal dimensions. Fill positions in reading order, left to right, top to bottom.
Do not draw grid lines or cell frames. Do not add a sheet title, watermark, slot labels, or numbers.

CELL ISOLATION — REQUIRED
Keep the entire character, caption, props, strokes, outlines, shadows, and effects inside their own cell.
Target 30 pixels of completely transparent safety space along every cell edge; never less than 20 pixels at the recommended resolution.
Scale that safety space proportionally if the output resolution differs.
Nothing may cross a cell boundary, touch a neighboring sticker, or be clipped by the sheet edge.
Use one clear expressive moment per cell. Keep captions readable at final sticker size.

TRANSPARENCY — REQUIRED
The background and all space between stickers must have actual transparent alpha pixels.
Output PNG, not JPEG or a screenshot.
Do not paint white, gray, black, or checkerboard backgrounds or background panels.
White foreground fur or caption outlines are allowed; they are not backgrounds.

CONTENT — EXACTLY 20 PAIRS
Render each provided caption exactly as written, including its punctuation and language.
Do not print the list indices or row/column labels. An explicitly empty caption means no caption in that cell.
Do not add, omit, reorder, or repeat stickers.
<Insert all 20 caption/action pairs here, with planning-only positions row 1 column 1 through row 5 column 4.>

Produce the image itself. Do not replace the requested image with a JSON list or a textual description.
```

For a repair prompt, keep this contract and name only the observed defects and
specific affected cells. Keep correct captions and character details unchanged.
