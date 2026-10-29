/**
 * Frame-by-frame animation generation with storyboard and continuity.
 * Image generation goes through ImageProvider (Gemini or OpenRouter).
 * Storyboard planning: Gemini multimodal when provider is Gemini; algorithmic
 * for OpenRouter (no direct Gemini SDK calls on the OpenRouter path).
 */

import { logger } from '../../utils/logger';
import {
  formatImageProviderError,
  getImageProvider,
  type ImageProviderId,
} from '../imageProviders';
import { abortableDelay, isAbortError, throwIfAborted } from '../../utils/abort';
import { planAnimationStoryboard } from './storyboard';
import { API_KEY_MISSING_MESSAGE } from './types';
import type { ProgressCallback } from './types';

export interface GenerateAnimationFramesOptions {
  /** Defaults to gemini. */
  providerId?: ImageProviderId;
  signal?: AbortSignal;
}

function buildFramePrompt(
  userPrompt: string,
  frameDesc: string,
  frameIndex: number,
  frameCount: number,
  hasPreviousFrame: boolean,
): string {
  return `
    Task: Generate Frame ${frameIndex + 1} of ${frameCount} for a sprite sheet.
    Action: "${userPrompt}".
    Pose Description: ${frameDesc}.
    
    [STRICT RULES]
    1. STYLE: Match "Reference Character" exactly (Colors, Proportions, Shading).
    2. BACKGROUND: Solid White (#FFFFFF).
    3. CONTINUITY: ${hasPreviousFrame ? 'The new frame must logically follow "Previous Frame" to create smooth animation.' : 'Start the animation sequence.'}
    4. ANCHOR: Keep the character size and ground position consistent.
    5. FORMAT: Single character, centered.
    `;
}

export async function generateAnimationFrames(
  imageBase64: string,
  prompt: string,
  frameCount: number,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  interFrameDelayMs: number = 4000,
  options?: GenerateAnimationFramesOptions,
): Promise<string[]> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const providerId = options?.providerId ?? 'gemini';
  const signal = options?.signal;
  throwIfAborted(signal);
  const provider = getImageProvider(providerId);

  const frameDescriptions = await planAnimationStoryboard({
    providerId,
    apiKey,
    imageBase64,
    userPrompt: prompt,
    frameCount,
    onProgress,
    signal,
  });
  throwIfAborted(signal);

  const generateFrame = async (
    frameDesc: string,
    i: number,
    prevFrameBase64: string | null,
  ): Promise<string> => {
    const fullPrompt = buildFramePrompt(
      prompt,
      frameDesc,
      i,
      frameCount,
      !!prevFrameBase64,
    );

    try {
      return await provider.generateImage({
        imageBase64,
        primaryImageCaption: 'Reference Character (Style/Design Source)',
        additionalImages: prevFrameBase64
          ? [
              {
                imageBase64: prevFrameBase64,
                caption: `Previous Frame ${i} (Motion Context)`,
              },
            ]
          : undefined,
        prompt: fullPrompt,
        model,
        apiKey,
        signal,
        onProgress,
      });
    } catch (err) {
      throwIfAborted(signal);
      if (isAbortError(err)) throw err;
      throw formatImageProviderError(providerId, err);
    }
  };

  const results: string[] = [];
  let previousFrame: string | null = null;

  if (onProgress) onProgress('分鏡規劃完成，準備繪製...');
  await abortableDelay(2000, signal);

  for (let i = 0; i < frameDescriptions.length; i++) {
    throwIfAborted(signal);
    const desc = frameDescriptions[i]!;
    try {
      if (onProgress) {
        onProgress(
          `正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`,
        );
      }

      if (i > 0) {
        if (onProgress && interFrameDelayMs > 1000) {
          onProgress(
            `等待 API 冷卻 (${Math.round(interFrameDelayMs / 1000)}秒)... 準備繪製第 ${i + 1} 幀`,
          );
        }
        await abortableDelay(interFrameDelayMs, signal);
        if (onProgress) {
          onProgress(
            `正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`,
          );
        }
      }

      const frameResult = await generateFrame(desc, i, previousFrame);
      throwIfAborted(signal);
      results.push(frameResult);
      previousFrame = frameResult;
    } catch (error: unknown) {
      if (isAbortError(error)) throw error;
      logger.error(`Generation failed at frame ${i + 1}`, error);
      throw error;
    }
  }

  return results;
}
