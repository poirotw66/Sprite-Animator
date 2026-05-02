/**
 * Sprite sheet image generation (single grid image via Gemini).
 */

import { GoogleGenAI } from '@google/genai';
import { getErrorMessage } from '../../types/errors';
import { CHROMA_KEY_COLORS, type ImageResolution } from '../../utils/constants';
import type { ChromaKeyColorType } from '../../types';
import { retryOperation } from './retry';
import { getBestAspectRatio, normalizeBackgroundColor } from './imageUtils';
import {
  isLineStickerPrompt,
  isStylePreviewPrompt,
  buildLineStickerPromptSuffix,
  buildAnimationSpriteSheetPrompt,
} from './spriteSheetPrompts';
import { API_KEY_MISSING_MESSAGE } from './types';
import type { ProgressCallback } from './types';
import { throwIfAborted } from '../../utils/abort';

export async function generateSpriteSheet(
  imageBase64: string,
  prompt: string,
  cols: number,
  rows: number,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  chromaKeyColor: ChromaKeyColorType = 'green',
  outputResolution?: ImageResolution,
  /** For LINE sticker mode only: when false, prompt suffix explicitly forbids any text in the image. */
  lineStickerIncludeText?: boolean,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);
  throwIfAborted(signal);

  const ai = new GoogleGenAI({ apiKey });
  const bgColor = CHROMA_KEY_COLORS[chromaKeyColor];
  const bgColorHex = bgColor.hex;
  const bgColorRGB = `RGB(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
  const cleanBase64 = imageBase64.replace(
    /^data:image\/(png|jpeg|jpg|webp);base64,/,
    ''
  );

  const targetAspectRatio = getBestAspectRatio(cols, rows);
  const totalFrames = cols * rows;

  const promptOpts = {
    cols,
    rows,
    totalFrames,
    bgColorHex,
    bgColorRGB,
    chromaKeyColor,
    ...(isLineStickerPrompt(prompt) && {
      includeText: lineStickerIncludeText ?? true,
    }),
  };

  const stylePreview = isStylePreviewPrompt(prompt);
  const fullPrompt = stylePreview
    ? prompt
    : isLineStickerPrompt(prompt)
      ? buildLineStickerPromptSuffix(prompt, promptOpts)
      : buildAnimationSpriteSheetPrompt(prompt, promptOpts);

  if (stylePreview) {
    if (onProgress) onProgress('正在生成風格預覽...');
  } else if (isLineStickerPrompt(prompt)) {
    if (onProgress)
      onProgress(
        `正在生成 ${cols}x${rows} LINE 貼圖精靈圖 (比例 ${targetAspectRatio})...`
      );
  } else {
    if (onProgress)
      onProgress(
        `正在生成 ${cols}x${rows} 連貫動作精靈圖 (比例 ${targetAspectRatio})...`
      );
  }

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
      aspectRatio: targetAspectRatio,
      ...(includeImageSize &&
        outputResolution && { imageSize: outputResolution }),
    },
  });

  const generateRequest = (config: ReturnType<typeof buildConfig>) =>
    ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: fullPrompt },
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
      signal
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
        signal
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
                { text: fullPrompt },
              ],
            },
            config: { abortSignal: signal },
          }),
        onProgress,
        5,
        4000,
        signal
      );
    }
  }

  throwIfAborted(signal);
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        const generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        if (stylePreview) {
          return generatedImage;
        }
        if (onProgress) onProgress('正在標準化背景顏色...');
        const normalizedImage = await normalizeBackgroundColor(
          generatedImage,
          bgColor,
          chromaKeyColor,
          signal
        );
        return normalizedImage;
      }
    }
  }
  throw new Error('No image data received for sprite sheet');
}
