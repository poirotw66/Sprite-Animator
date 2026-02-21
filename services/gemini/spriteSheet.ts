/**
 * Sprite sheet image generation (single grid image via Gemini).
 */

import { GoogleGenAI } from '@google/genai';
import { CHROMA_KEY_COLORS, type ImageResolution } from '../../utils/constants';
import type { ChromaKeyColorType } from '../../types';
import { retryOperation } from './retry';
import { getBestAspectRatio, normalizeBackgroundColor } from './imageUtils';
import {
  isLineStickerPrompt,
  buildLineStickerPromptSuffix,
  buildAnimationSpriteSheetPrompt,
} from './spriteSheetPrompts';
import { API_KEY_MISSING_MESSAGE } from './types';
import type { ProgressCallback } from './types';

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
  lineStickerIncludeText?: boolean
): Promise<string> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

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

  const fullPrompt = isLineStickerPrompt(prompt)
    ? buildLineStickerPromptSuffix(prompt, promptOpts)
    : buildAnimationSpriteSheetPrompt(prompt, promptOpts);

  if (isLineStickerPrompt(prompt)) {
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
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes('400') ||
      msg.includes('INVALID_ARGUMENT') ||
      msg.includes('invalid argument')
    );
  };

  const buildConfig = (includeImageSize: boolean) => ({
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
      onProgress
    );
  } catch (firstErr) {
    if (!isInvalidArgument(firstErr)) throw firstErr;
    if (onProgress) onProgress('正在重試（略過輸出尺寸參數）...');
    try {
      response = await retryOperation(
        () => generateRequest(buildConfig(false)),
        onProgress
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
          }),
        onProgress
      );
    }
  }

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        const generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        if (onProgress) onProgress('正在標準化背景顏色...');
        const normalizedImage = await normalizeBackgroundColor(
          generatedImage,
          bgColor,
          chromaKeyColor
        );
        return normalizedImage;
      }
    }
  }
  throw new Error('No image data received for sprite sheet');
}
