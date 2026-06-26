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
import { buildLineStickerPromptSuffix } from '../../../../services/gemini/spriteSheetPrompts.ts';
import { CHROMA_KEY_COLORS } from '../../../../utils/constants.ts';
import type { ChromaKeyColorType } from '../../../../types.ts';

/** Gemini's supported aspect ratios; pick the closest to cols/rows. */
function getBestAspectRatio(cols: number, rows: number): string {
  const target = cols / rows;
  const supported = [
    { str: '1:1', val: 1.0 },
    { str: '3:4', val: 0.75 },
    { str: '4:3', val: 1.333 },
    { str: '9:16', val: 0.5625 },
    { str: '16:9', val: 1.778 },
    { str: '1:4', val: 0.25 },
    { str: '4:1', val: 4.0 },
    { str: '1:8', val: 0.125 },
    { str: '8:1', val: 8.0 },
  ];
  return supported.reduce((prev, curr) =>
    Math.abs(curr.val - target) < Math.abs(prev.val - target) ? curr : prev
  ).str;
}

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
const SAFE_FRAMING_INSTRUCTION = `

---

### [Edge Safety — CRITICAL, overrides any earlier size guidance]

* Every subject (including hair, raised arms, hands, and props) MUST sit COMPLETELY INSIDE its own cell.
* Leave a clear empty background margin of at least **15% of the cell on ALL four sides**. Nothing may touch or cross a cell boundary.
* Make each subject **smaller** if needed so the whole silhouette fits with that margin. The subject should occupy roughly the central **60–70%** of the cell, not fill it edge-to-edge.
* Prefer a head-to-chest **bust** that ends ABOVE the bottom cell edge — do NOT let the body fill down to the bottom border.
* Center each subject with even breathing room; no part may bleed into a neighbouring cell.`;

export interface GenerateSheetParams {
  /** Base64 of the reference character image (no data: prefix). */
  referenceBase64: string;
  referenceMimeType: string;
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
  onStatus?: (msg: string) => void;
}

/** Generate one sprite-sheet PNG. Returns raw PNG bytes (no chroma removal yet). */
export async function generateSheetImage(
  params: GenerateSheetParams
): Promise<Uint8Array> {
  const {
    referenceBase64,
    referenceMimeType,
    prompt,
    cols,
    rows,
    apiKey,
    model,
    chromaKeyColor,
    includeText,
    outputResolution,
    onStatus,
  } = params;

  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const ai = new GoogleGenAI({ apiKey });
  const bg = CHROMA_KEY_COLORS[chromaKeyColor];
  const totalFrames = cols * rows;
  const aspectRatio = getBestAspectRatio(cols, rows);

  const fullPrompt =
    buildLineStickerPromptSuffix(prompt, {
      cols,
      rows,
      totalFrames,
      bgColorHex: bg.hex,
      bgColorRGB: `RGB(${bg.r}, ${bg.g}, ${bg.b})`,
      chromaKeyColor,
      includeText,
    }) + SAFE_FRAMING_INSTRUCTION;

  const request = (includeImageSize: boolean) =>
    ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: { mimeType: referenceMimeType, data: referenceBase64 },
          },
          { text: fullPrompt },
        ],
      },
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

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        return Uint8Array.from(Buffer.from(part.inlineData.data, 'base64'));
      }
    }
  }
  throw new Error('No image data received from Gemini for sprite sheet');
}
