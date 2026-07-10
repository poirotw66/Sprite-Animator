/**
 * Headless Gemini sprite-sheet generation for the LINE sticker skill.
 *
 * A thin, Node-friendly version of `services/gemini/spriteSheet.ts` with the
 * browser/React glue removed (no AbortController plumbing). Background color
 * normalization runs in `nodeImage.processSheetChromaKey` before the shared
 * chroma-key core — same rules as the web app's `normalizeBackgroundColor`.
 * prompt SUFFIX is reused as-is from the app so wording stays in sync.
 */

import { GoogleGenAI } from '@google/genai';
import {
  buildGridLayoutAnchorBlock,
  buildGridLayoutReminderBlock,
  buildLineStickerPromptSuffix,
} from '../../../../services/gemini/spriteSheetPrompts.ts';
import { getLineStickerSpriteSheetAspectRatio } from '../../../../utils/lineStickerSheetAspect.ts';
import { CHROMA_KEY_COLORS } from '../../../../utils/constants.ts';
import type { ChromaKeyColorType } from '../../../../types.ts';

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overload|rate limit/i.test(msg);
}

/** True only when a 400 is specifically about the imageSize/resolution param. */
function isImageSizeRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const is400 = /400|INVALID_ARGUMENT|invalid argument/i.test(msg);
  return is400 && /image.?size|imageConfig|resolution/i.test(msg);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Skill-scoped framing guard appended to the prompt. Forces the model to keep
 * each whole subject inside its cell with a wide margin, so per-cell slicing
 * never clips hair / raised hands / body. Kept here (not in the shared prompt
 * builder) so the web app's framing is unchanged.
 */
/** Flash Lite is not optimized for multi-image editing; guided mode needs flash-image. */
const GUIDED_GRID_SHEET_MODEL = 'gemini-3.1-flash-image';
const FLASH_LITE_IMAGE_MODEL = /flash-lite-image/i;

export function resolveModelForGuidedGridTemplate(
  model: string,
  gridTemplateMode: 'solid' | 'guided'
): string {
  if (gridTemplateMode === 'guided' && FLASH_LITE_IMAGE_MODEL.test(model)) {
    return GUIDED_GRID_SHEET_MODEL;
  }
  return model;
}

interface AttachmentIndices {
  gridTemplate?: number;
  characterPrimary: number;
  characterCompanion?: number;
  styleAnchor?: number;
}

function resolveAttachmentIndices(
  gridTemplateMode: 'solid' | 'guided',
  hasGridTemplate: boolean,
  hasCompanion: boolean,
  hasStyleAnchor: boolean
): AttachmentIndices {
  if (gridTemplateMode === 'guided' && hasGridTemplate) {
    return { gridTemplate: 1, characterPrimary: 2 };
  }
  let index = 1;
  const characterPrimary = index++;
  const characterCompanion = hasCompanion ? index++ : undefined;
  const styleAnchor = hasStyleAnchor ? index++ : undefined;
  const gridTemplate = hasGridTemplate ? index++ : undefined;
  return { gridTemplate, characterPrimary, characterCompanion, styleAnchor };
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function buildGuidedGridEditAnchorBlock(cols: number, rows: number, templateImageIndex: number): string {
  const totalFrames = cols * rows;
  return `### [0. EDIT THE PROVIDED GRID CANVAS — IMAGE ${templateImageIndex}]

Using the provided grid canvas (**attached image ${templateImageIndex}**), add sticker artwork to each cell.
This is an **image-edit** task — **do not** generate a new sheet layout from scratch.

**CANVAS (already correct in image ${templateImageIndex}):**
- Exactly **${cols} columns × ${rows} rows** = **${totalFrames} cells** on green chroma.
- Grid lines in image ${templateImageIndex} mark exact cell boundaries.
- **Keep image ${templateImageIndex}'s grid geometry pixel-perfect** — same column widths, row heights, and seam positions.

**FORBIDDEN:**
- Redrawing, relocating, thickening, or adding new grid/divider lines (especially white or black).
- Changing column or row count (never ${cols + 1} columns, never irregular panel sizes).
- Replacing the green background with a new layout.

---
`;
}

function buildGuidedLayoutOverrideBlock(cols: number, rows: number, templateImageIndex: number): string {
  return `

---

### [Guided canvas override — supersedes generic layout rules]
- Image ${templateImageIndex} is the authoritative **${cols}×${rows}** grid. Edit it in place.
- Ignore instructions to invent a new grid or to hide all dividers — keep the existing faint grid lines from image ${templateImageIndex}.
- Output must align with image ${templateImageIndex}'s seams; do not output a freshly composed collage.`;
}

function buildGridTemplateInstruction(
  cols: number,
  rows: number,
  chromaKeyColor: ChromaKeyColorType,
  mode: 'solid' | 'guided',
  templateImageIndex?: number
): string {
  const totalFrames = cols * rows;
  const bg = CHROMA_KEY_COLORS[chromaKeyColor];
  if (mode === 'guided') {
    const img = templateImageIndex ?? 1;
    return `

---

### [Grid layout canvas — EDIT IMAGE ${img}]
Using the provided grid canvas (attached image ${img}): **${cols} columns × ${rows} rows** = **${totalFrames} cells** on ${chromaKeyColor.toUpperCase()} (${bg.hex}).
- **Add sticker art on top of image ${img}**, one subject per visible cell — preserve the existing grid.
- The faint grid lines are alignment guides — **do not** redraw, thicken, or add white/black divider lines.
- Every row has exactly **${cols}** equal-width cells; never add a fifth column in any row.
- Do **not** change the background color outside your artwork (keep ${chromaKeyColor} gutters intact).
- Keep ~**10–15%** ${chromaKeyColor} margin inside every cell. Prefer bust framing over full-body poses that touch edges.`;
  }
  return `

---

### [Grid canvas — MANDATORY]
The attached solid **${chromaKeyColor.toUpperCase()}** canvas is your drawing surface: **${cols} columns × ${rows} rows** = **${totalFrames} cells**.
- Paint sticker art inside each cell only. Subjects must **not** cross cell boundaries.
- Do **not** draw grid lines, borders, cell numbers, or change the background color (${bg.hex} / RGB ${bg.r},${bg.g},${bg.b}).
- Keep ~**10–15%** ${chromaKeyColor} margin inside every cell. Prefer bust framing over full-body poses that touch edges.`;
}

function buildSafeFramingInstruction(
  cols: number,
  rows: number,
  guidedCanvas: boolean,
  templateImageIndex?: number
): string {
  const cellWidthPct = (100 / cols).toFixed(1);
  const cellHeightPct = (100 / rows).toFixed(1);
  const gridNote = guidedCanvas
    ? `* Re-confirm image ${templateImageIndex ?? 1}'s grid: **${cols}×${rows}** only — never drift to ${cols + 1} columns.`
    : `* Re-confirm [0. GRID LAYOUT]: **${cols}×${rows}** only — never drift to ${cols + 1} columns or a ${cols + 1}×${cols + 1} square.`;
  return `

---

### [Edge Safety — CRITICAL]

${gridNote}
* Each cell = **${cellWidthPct}%** width × **${cellHeightPct}%** height; image edges = grid edges.
* Every subject (hair, arms, hands, props) stays COMPLETELY inside its own cell — never crosses a boundary.
* Keep ~**10–15%** chroma margin on all four sides inside each cell. Subject occupies central **~65–75%** of the cell.
* Prefer head-to-chest **bust**; shrink the subject rather than letting it bleed into neighbours.`;
}

function buildCompanionBlock(indices: AttachmentIndices): string {
  if (!indices.characterCompanion) return '';
  return `

---

### [Dual character references]

The **${ordinal(indices.characterPrimary)}** attached image is character A (primary). The **${ordinal(indices.characterCompanion)}** is character B (companion).
Match each cell's action description — draw A, B, or both together as specified.
Keep both designs consistent with their reference sheets (species, colors, lazy yurukawa style).`;
}

function buildCharacterRefBlock(indices: AttachmentIndices): string {
  return `

---

### [Character design reference]

The **${ordinal(indices.characterPrimary)}** attached image is the character design reference. Match species, palette, line weight, and proportions exactly.`;
}

function buildStyleAnchorBlock(styleAnchorIndex: number): string {
  return `

---

### [Style continuity — sheet 2+]

The **${ordinal(styleAnchorIndex)}** attached image is the **processed sheet from the previous batch** in this set.
Match its character design, line weight, palette, proportions, and sticker framing exactly.
Same artist, same set — only new poses/phrases for this batch.`;
}

function buildGuidedGridReminderBlock(
  cols: number,
  rows: number,
  templateImageIndex: number
): string {
  const totalFrames = cols * rows;
  return `

---

### [FINAL REMINDER — edit image ${templateImageIndex} in place]
- Image ${templateImageIndex} already has **${cols} columns × ${rows} rows** = **${totalFrames} cells**. Do not invent a new layout.
- Keep image ${templateImageIndex}'s grid lines and green gutters intact; only add sticker art inside each cell.
- Each row has **${cols}** stickers only. Count them before output.`;
}

export interface StyleAnchorImage {
  base64: string;
  mimeType: string;
}

export interface GenerateSheetParams {
  /** Base64 of the reference character image (no data: prefix). */
  referenceBase64: string;
  referenceMimeType: string;
  /** Optional second character reference (e.g. duo sticker set). */
  companionReference?: StyleAnchorImage;
  /** Optional processed prior sheet for style continuity (sheet-2+). */
  styleAnchor?: StyleAnchorImage;
  /** Prompt body from `buildLineStickerPrompt` (chroma suffix added here). */
  prompt: string;
  cols: number;
  rows: number;
  apiKey: string;
  model: string;
  chromaKeyColor: ChromaKeyColorType;
  includeText: boolean;
  /** Output resolution (e.g. '1K'); dropped automatically if the model rejects it. */
  outputResolution?: string;
  /** Optional chroma canvas / guided layout reference for template-mode slicing. */
  gridTemplate?: StyleAnchorImage;
  /** `solid` = blank chroma (plan A). `guided` = visible grid layout ref (plan B). */
  gridTemplateMode?: 'solid' | 'guided';
  /** Appended when a prior attempt failed grid validation (auto-retry). */
  gridRetrySuffix?: string;
  onStatus?: (msg: string) => void;
}

/** Generate one sprite-sheet PNG. Returns raw PNG bytes (no chroma removal yet). */
export async function generateSheetImage(
  params: GenerateSheetParams
): Promise<Uint8Array> {
  const {
    referenceBase64,
    referenceMimeType,
    companionReference,
    styleAnchor,
    prompt,
    cols,
    rows,
    apiKey,
    model,
    chromaKeyColor,
    includeText,
    outputResolution,
    gridRetrySuffix = '',
    onStatus,
    gridTemplate,
    gridTemplateMode = 'solid',
  } = params;

  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const effectiveModel = resolveModelForGuidedGridTemplate(model, gridTemplateMode);
  if (effectiveModel !== model) {
    onStatus?.(`guided grid needs multi-image editing — using ${effectiveModel} instead of ${model}`);
  }

  const ai = new GoogleGenAI({ apiKey });
  const bg = CHROMA_KEY_COLORS[chromaKeyColor];
  const totalFrames = cols * rows;
  const aspectRatio = getLineStickerSpriteSheetAspectRatio();
  const guidedCanvas = gridTemplateMode === 'guided' && Boolean(gridTemplate);
  const indices = resolveAttachmentIndices(
    gridTemplateMode,
    Boolean(gridTemplate),
    Boolean(companionReference),
    Boolean(styleAnchor)
  );

  const gridAnchor = guidedCanvas && indices.gridTemplate
    ? buildGuidedGridEditAnchorBlock(cols, rows, indices.gridTemplate)
    : buildGridLayoutAnchorBlock(cols, rows);
  const gridReminder =
    guidedCanvas && indices.gridTemplate
      ? buildGuidedGridReminderBlock(cols, rows, indices.gridTemplate)
      : buildGridLayoutReminderBlock(cols, rows);
  const styleAnchorBlock =
    !guidedCanvas && styleAnchor && indices.styleAnchor
      ? buildStyleAnchorBlock(indices.styleAnchor)
      : '';
  const companionBlock = guidedCanvas ? '' : buildCompanionBlock(indices);
  const characterRefBlock = guidedCanvas ? buildCharacterRefBlock(indices) : '';
  const gridTemplateBlock = gridTemplate
    ? buildGridTemplateInstruction(
        cols,
        rows,
        chromaKeyColor,
        gridTemplateMode,
        indices.gridTemplate
      )
    : '';
  const guidedOverrideBlock =
    guidedCanvas && indices.gridTemplate
      ? buildGuidedLayoutOverrideBlock(cols, rows, indices.gridTemplate)
      : '';
  const fullPrompt =
    gridAnchor +
    characterRefBlock +
    companionBlock +
    buildLineStickerPromptSuffix(prompt, {
      cols,
      rows,
      totalFrames,
      bgColorHex: bg.hex,
      bgColorRGB: `RGB(${bg.r}, ${bg.g}, ${bg.b})`,
      chromaKeyColor,
      includeText,
    }) +
    guidedOverrideBlock +
    buildSafeFramingInstruction(cols, rows, guidedCanvas, indices.gridTemplate) +
    gridTemplateBlock +
    styleAnchorBlock +
    gridReminder +
    gridRetrySuffix;

  const contentParts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
  if (guidedCanvas && gridTemplate) {
    contentParts.push({
      inlineData: { mimeType: gridTemplate.mimeType, data: gridTemplate.base64 },
    });
    contentParts.push({ inlineData: { mimeType: referenceMimeType, data: referenceBase64 } });
    contentParts.push({ text: fullPrompt });
  } else {
    contentParts.push({ inlineData: { mimeType: referenceMimeType, data: referenceBase64 } });
    if (companionReference) {
      contentParts.push({
        inlineData: { mimeType: companionReference.mimeType, data: companionReference.base64 },
      });
    }
    if (styleAnchor) {
      contentParts.push({
        inlineData: { mimeType: styleAnchor.mimeType, data: styleAnchor.base64 },
      });
    }
    if (gridTemplate) {
      contentParts.push({
        inlineData: { mimeType: gridTemplate.mimeType, data: gridTemplate.base64 },
      });
    }
    contentParts.push({ text: fullPrompt });
  }

  const request = (includeImageSize: boolean) =>
    ai.models.generateContent({
      model: effectiveModel,
      contents: { parts: contentParts },
      config: {
        imageConfig: {
          aspectRatio,
          ...(includeImageSize && outputResolution
            ? { imageSize: outputResolution }
            : {}),
        },
      },
    });

  const maxRetries = 5;
  let lastErr: unknown;
  let includeImageSize = Boolean(outputResolution);
  let response: Awaited<ReturnType<typeof request>> | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      response = await request(includeImageSize);
      break;
    } catch (err) {
      lastErr = err;
      // Model rejected the imageSize param: retry once without it (don't burn an attempt).
      if (includeImageSize && isImageSizeRejection(err)) {
        onStatus?.('model rejected imageSize; retrying without output resolution');
        includeImageSize = false;
        attempt--;
        continue;
      }
      if (!isRetryable(err) || attempt === maxRetries - 1) throw err;
      const delay = 4000 * Math.pow(2, attempt) + Math.random() * 1000;
      onStatus?.(
        `API busy (${Math.round(delay / 1000)}s backoff, attempt ${attempt + 1}/${maxRetries})`
      );
      await wait(delay);
    }
  }
  if (!response) throw lastErr ?? new Error('No response from Gemini');

  const maxEmptyImageRetries = 3;
  for (let emptyAttempt = 0; emptyAttempt < maxEmptyImageRetries; emptyAttempt++) {
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          return Uint8Array.from(Buffer.from(part.inlineData.data, 'base64'));
        }
      }
    }

    if (emptyAttempt >= maxEmptyImageRetries - 1) {
      break;
    }

    const delay = 2500 + Math.random() * 1500;
    onStatus?.(
      `no image in Gemini response; retrying in ${Math.round(delay / 1000)}s (${emptyAttempt + 2}/${maxEmptyImageRetries})`
    );
    await wait(delay);

    try {
      response = await request(includeImageSize);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      onStatus?.('API busy during empty-image retry; backing off…');
      await wait(4000);
      response = await request(includeImageSize);
    }
  }

  throw new Error('No image data received from Gemini for sprite sheet');
}
