/**
 * Gemini image call for character model-sheet generation.
 */

import { GoogleGenAI } from '@google/genai';

import { DEFAULT_MODEL } from '../../../../utils/constants.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overload|rate limit/i.test(msg);
}

function isImageSizeRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /400|INVALID_ARGUMENT|invalid argument/i.test(msg) && /image.?size|imageConfig|resolution/i.test(msg);
}

export interface GenerateCharacterRefParams {
  apiKey: string;
  prompt: string;
  layoutRefBase64: string;
  layoutRefMimeType: string;
  identityRefBase64?: string;
  identityRefMimeType?: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  onStatus?: (msg: string) => void;
}

export async function generateCharacterRefImage(
  params: GenerateCharacterRefParams
): Promise<Uint8Array> {
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

  const contentParts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [
    { inlineData: { mimeType: layoutRefMimeType, data: layoutRefBase64 } },
  ];

  if (identityRefBase64 && identityRefMimeType) {
    contentParts.push({
      inlineData: { mimeType: identityRefMimeType, data: identityRefBase64 },
    });
  }

  const identityBlock =
    identityRefBase64 && identityRefMimeType
      ? `

The second attached image is an **identity sketch**. Match this character's species, palette, and key features while applying the Art style and sheet layout above.`
      : '';

  contentParts.push({ text: prompt + identityBlock });

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

  const maxRetries = 5;
  let lastErr: unknown;
  let includeImageSize = Boolean(resolution);
  let response: Awaited<ReturnType<typeof request>> | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      response = await request(includeImageSize);
      break;
    } catch (err) {
      lastErr = err;
      if (includeImageSize && isImageSizeRejection(err)) {
        onStatus?.('model rejected imageSize; retrying without resolution');
        includeImageSize = false;
        attempt--;
        continue;
      }
      if (!isRetryable(err) || attempt === maxRetries - 1) throw err;
      const delay = 4000 * 2 ** attempt + Math.random() * 1000;
      onStatus?.(`API busy (${Math.round(delay / 1000)}s backoff, attempt ${attempt + 1}/${maxRetries})`);
      await wait(delay);
    }
  }
  if (!response) throw lastErr ?? new Error('No response from Gemini');

  for (let emptyAttempt = 0; emptyAttempt < 3; emptyAttempt++) {
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          return Uint8Array.from(Buffer.from(part.inlineData.data, 'base64'));
        }
      }
    }
    if (emptyAttempt >= 2) break;
    onStatus?.(`no image in response; retry ${emptyAttempt + 2}/3`);
    await wait(2500);
    response = await request(includeImageSize);
  }

  throw new Error('No image data received from Gemini for character reference');
}
