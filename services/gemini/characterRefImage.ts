/**
 * Character model-sheet reference image generation via Gemini.
 */

import { GoogleGenAI } from '@google/genai';

import { DEFAULT_MODEL } from '../../utils/constants';
import { retryOperation, wait } from './retry';

function isImageSizeRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /400|INVALID_ARGUMENT|invalid argument/i.test(msg) &&
    /image.?size|imageConfig|resolution/i.test(msg)
  );
}

export interface GenerateCharacterRefParams {
  apiKey: string;
  prompt: string;
  /** Optional panel-arrangement reference (headless skill). Omit for comic web flow. */
  layoutRefBase64?: string;
  layoutRefMimeType?: string;
  identityRefBase64?: string;
  identityRefMimeType?: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  onStatus?: (msg: string) => void;
}

export async function generateCharacterRefImage(
  params: GenerateCharacterRefParams
): Promise<string> {
  const {
    apiKey,
    prompt,
    layoutRefBase64,
    layoutRefMimeType,
    identityRefBase64,
    identityRefMimeType,
    model = DEFAULT_MODEL,
    resolution = '1K',
    aspectRatio = '1:1',
    onStatus,
  } = params;

  const ai = new GoogleGenAI({ apiKey });

  const contentParts: Array<{
    inlineData?: { mimeType: string; data: string };
    text?: string;
  }> = [];

  const identityOnly =
    Boolean(identityRefBase64 && identityRefMimeType) && !layoutRefBase64;

  if (identityOnly) {
    contentParts.push({
      text: `The image below is the user's uploaded character reference.
Recreate THIS exact character in the model sheet (same species, face, colors, outfit, proportions).
Do NOT replace with a different character (e.g. otter, cat, generic mascot).`,
    });
    contentParts.push({
      inlineData: { mimeType: identityRefMimeType!, data: identityRefBase64! },
    });
    contentParts.push({ text: prompt });
  } else {
    if (layoutRefBase64 && layoutRefMimeType) {
      contentParts.push({
        inlineData: { mimeType: layoutRefMimeType, data: layoutRefBase64 },
      });
    }

    if (identityRefBase64 && identityRefMimeType) {
      contentParts.push({
        inlineData: { mimeType: identityRefMimeType, data: identityRefBase64 },
      });
    }

    const attachmentNote =
      layoutRefBase64 && identityRefBase64
        ? `

The first attached image is a **layout structure reference** only (panel arrangement). The second is an **identity sketch** — match species, palette, and key features from the identity image.`
        : layoutRefBase64
          ? `

The attached image is a **layout structure reference** only — copy panel arrangement, not the character design shown in it.`
          : identityRefBase64
            ? `

The attached image is the user's **character identity** — match it exactly (see prompt).`
            : '';

    contentParts.push({ text: prompt + attachmentNote });
  }

  const request = (includeImageSize: boolean) =>
    ai.models.generateContent({
      model,
      contents: { parts: contentParts },
      config: {
        imageConfig: {
          aspectRatio,
          ...(includeImageSize && resolution ? { imageSize: resolution } : {}),
        },
      },
    });

  let includeImageSize = Boolean(resolution);
  let response: Awaited<ReturnType<typeof request>>;

  try {
    response = await retryOperation(
      () => request(includeImageSize),
      onStatus,
      5,
      4000
    );
  } catch (firstErr) {
    if (includeImageSize && isImageSizeRejection(firstErr)) {
      onStatus?.('model rejected imageSize; retrying without resolution');
      includeImageSize = false;
      response = await retryOperation(
        () => request(false),
        onStatus,
        5,
        4000
      );
    } else {
      throw firstErr;
    }
  }

  for (let emptyAttempt = 0; emptyAttempt < 3; emptyAttempt++) {
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    if (emptyAttempt >= 2) break;
    onStatus?.(`no image in response; retry ${emptyAttempt + 2}/3`);
    await wait(2500);
    response = await retryOperation(
      () => request(includeImageSize),
      onStatus,
      5,
      4000
    );
  }

  throw new Error('No image data received from Gemini for character reference');
}
