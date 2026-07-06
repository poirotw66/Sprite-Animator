/**
 * Headless Gemini sprite-sheet generation for the LINE sticker skill.
 *
 * A thin, Node-friendly version of `services/gemini/spriteSheet.ts` with the
 * browser/React glue removed (no AbortController plumbing, no canvas-based
 * `normalizeBackgroundColor` — chroma-key auto-detects the dominant background,
 * so normalization is skipped per the skill's design). The chroma-key + layout
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
function buildSafeFramingInstruction(cols: number, rows: number): string {
  const cellWidthPct = (100 / cols).toFixed(1);
  const cellHeightPct = (100 / rows).toFixed(1);
  return `

---

### [Edge Safety — CRITICAL]

* Re-confirm [0. GRID LAYOUT]: **${cols}×${rows}** only — never drift to ${cols + 1} columns or a ${cols + 1}×${cols + 1} square.
* Each cell = **${cellWidthPct}%** width × **${cellHeightPct}%** height; image edges = grid edges.
* Every subject (hair, arms, hands, props) stays COMPLETELY inside its own cell — never crosses a boundary.
* Keep ~**10–15%** chroma margin on all four sides inside each cell. Subject occupies central **~65–75%** of the cell.
* Prefer head-to-chest **bust**; shrink the subject rather than letting it bleed into neighbours.`;
}

export interface StyleAnchorImage {
  base64: string;
  mimeType: string;
}

export interface GenerateSheetParams {
  /** Base64 of the reference character image (no data: prefix). */
  referenceBase64: string;
  referenceMimeType: string;
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
  } = params;

  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const ai = new GoogleGenAI({ apiKey });
  const bg = CHROMA_KEY_COLORS[chromaKeyColor];
  const totalFrames = cols * rows;
  const aspectRatio = getLineStickerSpriteSheetAspectRatio();

  const gridAnchor = buildGridLayoutAnchorBlock(cols, rows);
  const gridReminder = buildGridLayoutReminderBlock(cols, rows);
  const styleAnchorBlock = styleAnchor
    ? `

---

### [Style continuity — sheet 2+]

The second attached image is the **processed sheet from the previous batch** in this set.
Match its character design, line weight, palette, proportions, and sticker framing exactly.
Same artist, same set — only new poses/phrases for this batch.`
    : '';
  const fullPrompt =
    gridAnchor +
    buildLineStickerPromptSuffix(prompt, {
      cols,
      rows,
      totalFrames,
      bgColorHex: bg.hex,
      bgColorRGB: `RGB(${bg.r}, ${bg.g}, ${bg.b})`,
      chromaKeyColor,
      includeText,
    }) +
    buildSafeFramingInstruction(cols, rows) +
    styleAnchorBlock +
    gridReminder +
    gridRetrySuffix;

  const contentParts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [
    { inlineData: { mimeType: referenceMimeType, data: referenceBase64 } },
  ];
  if (styleAnchor) {
    contentParts.push({
      inlineData: { mimeType: styleAnchor.mimeType, data: styleAnchor.base64 },
    });
  }
  contentParts.push({ text: fullPrompt });

  const request = (includeImageSize: boolean) =>
    ai.models.generateContent({
      model,
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
