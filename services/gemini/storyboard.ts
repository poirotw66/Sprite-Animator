/**
 * Animation storyboard generation: break action into sequential keyframe descriptions.
 * Gemini uses a multimodal text model; OpenRouter uses an algorithmic fallback
 * (no separate text-planning call on the Images API).
 */

import { GoogleGenAI } from '@google/genai';
import type { GoogleGenAI as GoogleGenAIType } from '@google/genai';
import { logger } from '../../utils/logger';
import type { ImageProviderId } from '../imageProviders';
import { retryOperation, isQuotaError } from './retry';
import type { ProgressCallback } from './types';

export interface PlanAnimationStoryboardInput {
  providerId: ImageProviderId;
  apiKey: string;
  imageBase64: string;
  userPrompt: string;
  frameCount: number;
  onProgress?: ProgressCallback;
}

function algorithmicStoryboard(
  userPrompt: string,
  frameCount: number,
): string[] {
  return Array.from({ length: frameCount }, (_, i) => {
    const progress = i / (frameCount - 1 || 1);
    if (progress < 0.2) return `Preparation: ${userPrompt}`;
    if (progress < 0.8) return `Action: ${userPrompt}`;
    return `Recovery: ${userPrompt}`;
  });
}

function normalizeStoryboardLines(
  text: string,
  frameCount: number,
  userPrompt: string,
): string[] {
  const lines = text.split('\n').filter((line) => /^\d+[\.:]/.test(line.trim()));
  let storyboard = lines.map((line) => line.replace(/^\d+[\.:]\s*/, '').trim());

  if (storyboard.length === 0) {
    storyboard = text.split('\n').filter((l) => l.trim().length > 5);
  }

  if (storyboard.length > frameCount) {
    storyboard = storyboard.slice(0, frameCount);
  }

  if (storyboard.length < frameCount) {
    while (storyboard.length < frameCount) {
      storyboard.push(
        storyboard.length > 0 ? storyboard[storyboard.length - 1]! : userPrompt,
      );
    }
  }
  return storyboard;
}

/**
 * Generates an animation storyboard (frame descriptions) using Gemini multimodal.
 * Frame-by-frame orchestration should prefer planAnimationStoryboard instead.
 */
export async function getAnimationStoryboard(
  ai: GoogleGenAIType,
  imageBase64: string,
  userPrompt: string,
  frameCount: number,
  onProgress?: ProgressCallback,
): Promise<string[]> {
  const cleanBase64 = imageBase64.replace(
    /^data:image\/(png|jpeg|jpg|webp);base64,/,
    '',
  );

  if (onProgress) onProgress('正在規劃動作分鏡 (Storyboard)...');

  const planningModel = 'gemini-2.5-flash';

  const systemPrompt = `You are a professional 2D Frame-by-Frame Animator. 
  Breakdown the action "${userPrompt}" into EXACTLY ${frameCount} sequential keyframes.
  
  Rules:
  1. Output a plain NUMBERED LIST.
  2. No Markdown, No JSON, No intro text.
  3. Example:
     1. Character prepares to jump
     2. Character in mid-air
  `;

  try {
    const response = await retryOperation(
      async () =>
        await ai.models.generateContent({
          model: planningModel,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
              { text: systemPrompt },
            ],
          },
          config: {
            temperature: 1,
            maxOutputTokens: 1000,
          },
        }),
      onProgress,
    );

    const text = response.text ?? '';
    return normalizeStoryboardLines(text, frameCount, userPrompt);
  } catch (e: unknown) {
    if (isQuotaError(e)) {
      logger.error('Quota exceeded during storyboard generation. Aborting.');
      throw e;
    }

    logger.warn(
      'Storyboard generation failed (non-quota error), falling back to algorithmic descriptions.',
      e,
    );
    return algorithmicStoryboard(userPrompt, frameCount);
  }
}

/**
 * Provider-aware storyboard planning for frame-by-frame mode.
 * - Gemini: same multimodal planning as before (via GoogleGenAI).
 * - OpenRouter: algorithmic keyframes (Images API has no storyboard endpoint).
 */
export async function planAnimationStoryboard(
  input: PlanAnimationStoryboardInput,
): Promise<string[]> {
  const { providerId, apiKey, imageBase64, userPrompt, frameCount, onProgress } =
    input;

  if (providerId === 'gemini') {
    if (!apiKey) {
      return algorithmicStoryboard(userPrompt, frameCount);
    }
    const ai = new GoogleGenAI({ apiKey });
    return getAnimationStoryboard(
      ai,
      imageBase64,
      userPrompt,
      frameCount,
      onProgress,
    );
  }

  if (onProgress) {
    onProgress('正在規劃動作分鏡 (algorithmic storyboard)...');
  }
  return algorithmicStoryboard(userPrompt, frameCount);
}
