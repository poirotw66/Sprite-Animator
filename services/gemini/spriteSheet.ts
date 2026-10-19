/**
 * Sprite sheet image generation (single grid image).
 * Transport goes through ImageProvider (Gemini by default; OpenRouter optional).
 * LINE sticker / comic callers can keep passing Gemini keys and omit providerId.
 */

import { CHROMA_KEY_COLORS, type ImageResolution } from '../../utils/constants';
import type { ChromaKeyColorType } from '../../types';
import {
  getBestAspectRatio,
  getLineStickerSpriteSheetAspectRatio,
  normalizeBackgroundColor,
} from './imageUtils';
import {
  isLineStickerPrompt,
  isStylePreviewPrompt,
  buildGridLayoutAnchorBlock,
  buildGridLayoutReminderBlock,
  buildLineStickerPromptSuffix,
  buildAnimationSpriteSheetPrompt,
} from './spriteSheetPrompts';
import { API_KEY_MISSING_MESSAGE } from './types';
import type { ProgressCallback } from './types';
import { throwIfAborted } from '../../utils/abort';
import {
  getImageProvider,
  type ImageProviderId,
} from '../imageProviders';

/** Explicit sheet mode avoids sniffing LINE markers out of the prompt string. */
export type SpriteSheetKind = 'animation' | 'line-sticker' | 'style-preview';

export interface GenerateSpriteSheetOptions {
  /** Defaults to gemini so LINE / comic paths stay unchanged. */
  providerId?: ImageProviderId;
  /**
   * When set, drives prompt/aspect/progress without prompt-string heuristics.
   * When omitted, falls back to prompt markers (backward compatible).
   */
  sheetKind?: SpriteSheetKind;
  /** For LINE sticker mode only: when false, prompt suffix forbids on-image text. */
  lineStickerIncludeText?: boolean;
}

function resolveSheetKind(
  prompt: string,
  explicit?: SpriteSheetKind,
): SpriteSheetKind {
  if (explicit) return explicit;
  if (isStylePreviewPrompt(prompt)) return 'style-preview';
  if (isLineStickerPrompt(prompt)) return 'line-sticker';
  return 'animation';
}

function buildSpriteSheetPrompt(
  prompt: string,
  kind: SpriteSheetKind,
  opts: {
    cols: number;
    rows: number;
    totalFrames: number;
    bgColorHex: string;
    bgColorRGB: string;
    chromaKeyColor: ChromaKeyColorType;
    includeText?: boolean;
  },
): string {
  if (kind === 'style-preview') return prompt;
  if (kind === 'line-sticker') {
    return (
      buildGridLayoutAnchorBlock(opts.cols, opts.rows) +
      buildLineStickerPromptSuffix(prompt, {
        cols: opts.cols,
        rows: opts.rows,
        totalFrames: opts.totalFrames,
        bgColorHex: opts.bgColorHex,
        bgColorRGB: opts.bgColorRGB,
        chromaKeyColor: opts.chromaKeyColor,
        includeText: opts.includeText ?? true,
      }) +
      buildGridLayoutReminderBlock(opts.cols, opts.rows)
    );
  }
  return buildAnimationSpriteSheetPrompt(prompt, {
    cols: opts.cols,
    rows: opts.rows,
    totalFrames: opts.totalFrames,
    bgColorHex: opts.bgColorHex,
    bgColorRGB: opts.bgColorRGB,
    chromaKeyColor: opts.chromaKeyColor,
  });
}

function progressForSheetKind(
  kind: SpriteSheetKind,
  cols: number,
  rows: number,
  aspectRatio: string,
): string {
  if (kind === 'style-preview') return '正在生成風格預覽...';
  if (kind === 'line-sticker') {
    return `正在生成 ${cols}x${rows} LINE 貼圖精靈圖 (比例 ${aspectRatio})...`;
  }
  return `正在生成 ${cols}x${rows} 連貫動作精靈圖 (比例 ${aspectRatio})...`;
}

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
  /** @deprecated Prefer options.lineStickerIncludeText / options.sheetKind */
  lineStickerIncludeText?: boolean,
  signal?: AbortSignal,
  options?: GenerateSpriteSheetOptions,
): Promise<string> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);
  throwIfAborted(signal);

  const providerId = options?.providerId ?? 'gemini';
  const includeText =
    options?.lineStickerIncludeText ?? lineStickerIncludeText;
  const sheetKind = resolveSheetKind(prompt, options?.sheetKind);

  const bgColor = CHROMA_KEY_COLORS[chromaKeyColor];
  const bgColorHex = bgColor.hex;
  const bgColorRGB = `RGB(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
  const totalFrames = cols * rows;
  const targetAspectRatio =
    sheetKind === 'line-sticker'
      ? getLineStickerSpriteSheetAspectRatio()
      : getBestAspectRatio(cols, rows);

  const fullPrompt = buildSpriteSheetPrompt(prompt, sheetKind, {
    cols,
    rows,
    totalFrames,
    bgColorHex,
    bgColorRGB,
    chromaKeyColor,
    includeText,
  });

  if (onProgress) {
    onProgress(progressForSheetKind(sheetKind, cols, rows, targetAspectRatio));
  }

  const provider = getImageProvider(providerId);
  const generatedImage = await provider.generateImage({
    imageBase64,
    prompt: fullPrompt,
    model,
    apiKey,
    aspectRatio: targetAspectRatio,
    imageSize: outputResolution,
    signal,
    onProgress,
  });

  throwIfAborted(signal);

  if (sheetKind === 'style-preview') {
    return generatedImage;
  }

  if (onProgress) onProgress('正在標準化背景顏色...');
  return normalizeBackgroundColor(
    generatedImage,
    bgColor,
    chromaKeyColor,
    signal,
  );
}
