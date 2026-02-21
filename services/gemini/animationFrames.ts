/**
 * Frame-by-frame animation generation with storyboard and continuity.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';
import { wait } from './retry';
import { retryOperation } from './retry';
import { getAnimationStoryboard } from './storyboard';
import { API_KEY_MISSING_MESSAGE } from './types';
import type { ProgressCallback } from './types';

export async function generateAnimationFrames(
  imageBase64: string,
  prompt: string,
  frameCount: number,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  interFrameDelayMs: number = 4000
): Promise<string[]> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = imageBase64.replace(
    /^data:image\/(png|jpeg|jpg|webp);base64,/,
    ''
  );

  const frameDescriptions = await getAnimationStoryboard(
    ai,
    imageBase64,
    prompt,
    frameCount,
    onProgress
  );

  const generateFrame = async (
    frameDesc: string,
    i: number,
    prevFrameBase64: string | null
  ): Promise<string> => {
    const parts: Array<
      { inlineData?: { mimeType: string; data: string }; text?: string }
    > = [];

    parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
    parts.push({ text: 'Reference Character (Style/Design Source)' });

    if (prevFrameBase64) {
      const prevClean = prevFrameBase64.replace(
        /^data:image\/(png|jpeg|jpg|webp);base64,/,
        ''
      );
      parts.push({ inlineData: { mimeType: 'image/png', data: prevClean } });
      parts.push({ text: `Previous Frame ${i} (Motion Context)` });
    }

    const fullPrompt = `
    Task: Generate Frame ${i + 1} of ${frameCount} for a sprite sheet.
    Action: "${prompt}".
    Pose Description: ${frameDesc}.
    
    [STRICT RULES]
    1. STYLE: Match "Reference Character" exactly (Colors, Proportions, Shading).
    2. BACKGROUND: Solid White (#FFFFFF).
    3. CONTINUITY: ${prevFrameBase64 ? 'The new frame must logically follow "Previous Frame" to create smooth animation.' : 'Start the animation sequence.'}
    4. ANCHOR: Keep the character size and ground position consistent.
    5. FORMAT: Single character, centered.
    `;

    parts.push({ text: fullPrompt });

    const response = await retryOperation(
      async () =>
        await ai.models.generateContent({
          model,
          contents: { parts },
        }),
      onProgress
    );

    const resultParts = response.candidates?.[0]?.content?.parts;
    if (resultParts) {
      for (const part of resultParts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error(`No image data received for frame ${i + 1}`);
  };

  const results: string[] = [];
  let previousFrame: string | null = null;

  if (onProgress) onProgress('分鏡規劃完成，準備繪製...');
  await wait(2000);

  for (let i = 0; i < frameDescriptions.length; i++) {
    const desc = frameDescriptions[i]!;
    try {
      if (onProgress)
        onProgress(
          `正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`
        );

      if (i > 0) {
        if (onProgress && interFrameDelayMs > 1000) {
          onProgress(
            `等待 API 冷卻 (${Math.round(interFrameDelayMs / 1000)}秒)... 準備繪製第 ${i + 1} 幀`
          );
        }
        await wait(interFrameDelayMs);
        if (onProgress)
          onProgress(
            `正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`
          );
      }

      const frameResult = await generateFrame(desc, i, previousFrame);
      results.push(frameResult);
      previousFrame = frameResult;
    } catch (error: unknown) {
      logger.error(`Generation failed at frame ${i + 1}`, error);
      throw error;
    }
  }

  return results;
}
