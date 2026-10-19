import { GoogleGenAI } from '@google/genai';
import { getErrorMessage } from '../../types/errors';
import { retryOperation } from '../gemini/retry';
import { API_KEY_MISSING_MESSAGE } from '../gemini/types';
import { throwIfAborted } from '../../utils/abort';
import type { GenerateImageRequest, ImageProvider } from './types';

function stripDataUrlPrefix(imageBase64: string): string {
  return imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
}

/**
 * Existing Gemini image path, extracted for the ImageProvider interface.
 * Behavior matches the previous inline GoogleGenAI calls in spriteSheet.ts
 * (retry with imageSize → without imageSize → bare config).
 */
export const geminiImageProvider: ImageProvider = {
  id: 'gemini',

  async validateApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
    if (!apiKey.trim()) {
      throw new Error('API key is empty');
    }
    throwIfAborted(signal);
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    await ai.models.list();
  },

  async generateImage(request: GenerateImageRequest): Promise<string> {
    const {
      imageBase64,
      prompt,
      model,
      apiKey,
      aspectRatio,
      imageSize,
      signal,
      onProgress,
    } = request;

    if (!apiKey) {
      throw new Error(API_KEY_MISSING_MESSAGE);
    }
    throwIfAborted(signal);

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = stripDataUrlPrefix(imageBase64);

    const isInvalidArgument = (err: unknown): boolean => {
      const msg = getErrorMessage(err);
      return (
        msg.includes('400') ||
        msg.includes('INVALID_ARGUMENT') ||
        msg.includes('invalid argument')
      );
    };

    const buildConfig = (includeImageSize: boolean) => ({
      abortSignal: signal,
      imageConfig: {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(includeImageSize && imageSize ? { imageSize } : {}),
      },
    });

    const generateRequest = (config: ReturnType<typeof buildConfig>) =>
      ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
            { text: prompt },
          ],
        },
        config,
      });

    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await retryOperation(
        () => generateRequest(buildConfig(true)),
        onProgress,
        5,
        4000,
        signal,
      );
    } catch (firstErr) {
      if (!isInvalidArgument(firstErr)) throw firstErr;
      if (onProgress) onProgress('正在重試（略過輸出尺寸參數）...');
      try {
        response = await retryOperation(
          () => generateRequest(buildConfig(false)),
          onProgress,
          5,
          4000,
          signal,
        );
      } catch (secondErr) {
        if (!isInvalidArgument(secondErr)) throw secondErr;
        if (onProgress) onProgress('正在重試（略過影像設定）...');
        response = await retryOperation(
          () =>
            ai.models.generateContent({
              model,
              contents: {
                parts: [
                  { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
                  { text: prompt },
                ],
              },
              config: { abortSignal: signal },
            }),
          onProgress,
          5,
          4000,
          signal,
        );
      }
    }

    throwIfAborted(signal);
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          return `data:${mime};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error('No image data received for sprite sheet');
  },
};
