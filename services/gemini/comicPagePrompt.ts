import {
  COMIC_LAYOUT_4A,
  COMIC_PANEL_COUNT,
  type ComicPanel,
} from '../../utils/comicPanelSchema';

export interface BuildComicPagePromptParams {
  panels: ComicPanel[];
  styleBlock: string;
  characterConcept: string;
}

function panelBlock(panel: ComicPanel, humanIndex: number): string {
  const dialogueLine = panel.dialogue?.trim()
    ? `- Dialogue (Traditional Chinese, speech bubble): ${panel.dialogue.trim()}`
    : '- No dialogue in this panel';
  const cameraLine = panel.cameraNote?.trim()
    ? `- Camera: ${panel.cameraNote.trim()}`
    : '';
  return `### Panel ${humanIndex}
- Scene: ${panel.sceneDescription.trim()}
${dialogueLine}
${cameraLine}`.trim();
}

export function buildComicPagePrompt(params: BuildComicPagePromptParams): string {
  const { panels, styleBlock, characterConcept } = params;
  if (panels.length !== COMIC_PANEL_COUNT) {
    throw new Error(`Expected ${COMIC_PANEL_COUNT} panels, got ${panels.length}`);
  }

  const ordered = [...panels].sort((a, b) => a.index - b.index);
  const panelSection = ordered
    .map((p, i) => panelBlock(p, i + 1))
    .join('\n\n');

  return `Generate ONE finished four-panel comic page (yonkoma / 四格漫畫).

### [Page layout — 4A]
- Exactly ${COMIC_LAYOUT_4A.cols} columns × ${COMIC_LAYOUT_4A.rows} rows = ${COMIC_PANEL_COUNT} equal panels.
- Square page, 1:1 aspect ratio.
- Reading order: left→right, top→bottom (panels 1–4).
- **Visible comic gutters**: thin black borders between panels and around the page edge.
- Do NOT use invisible grid lines. This is a printed comic page, not a sprite sheet.

### [Character lock]
The attached image is the **character model sheet**. Use ONLY that character design in every panel.
- Match face, species, palette, outfit, proportions exactly.
- Do NOT redesign, age-shift, or swap species.
- Character concept for tone: ${characterConcept.trim() || '(see sheet)'}

### [Art style]
${styleBlock}

### [Panel directions]
${panelSection}

### [Text rules]
- Dialogue must be **Traditional Chinese** when provided.
- Render dialogue in clear speech bubbles; legible at phone screen size.
- No watermark, no UI chrome, no photorealism.

Output exactly **one** complete comic page image.`;
}
