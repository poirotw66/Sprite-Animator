import { GoogleGenAI } from '@google/genai';
import type { ComicPanel } from '../../utils/comicPanelSchema';
import { throwIfAborted } from '../../utils/abort';
import { dataUrlToBase64 } from '../../utils/loadBundledImage';
import { buildComicPagePrompt } from './comicPagePrompt';
import { resolveComicStyleBlock } from './comicCharacterSheet';
import { retryOperation } from './retry';
import { API_KEY_MISSING_MESSAGE, type ProgressCallback } from './types';

function isImageSizeRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /400|INVALID_ARGUMENT|invalid argument/i.test(msg) &&
    /image.?size|imageConfig|resolution/i.test(msg)
  );
}

export async function generateComicPage(params: {
  apiKey: string;
  model: string;
  resolution: string;
  characterSheetImage: string;
  characterConcept: string;
  styleKey: string;
  customStyle?: string;
  panels: ComicPanel[];
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}): Promise<string> {
  if (!params.apiKey) {
    throw new Error(API_KEY_MISSING_MESSAGE);
  }
  throwIfAborted(params.signal);

  const styleBlock = resolveComicStyleBlock(params.styleKey, params.customStyle);
  const prompt = buildComicPagePrompt({
    panels: params.panels,
    styleBlock,
    characterConcept: params.characterConcept,
  });

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const sheetBase64 = dataUrlToBase64(params.characterSheetImage);

  params.onProgress?.('正在生成四格漫畫頁…');

  const buildConfig = (includeImageSize: boolean) => ({
    abortSignal: params.signal,
    imageConfig: {
      aspectRatio: '1:1' as const,
      ...(includeImageSize && params.resolution ? { imageSize: params.resolution } : {}),
    },
  });

  const request = (config: ReturnType<typeof buildConfig>) =>
    ai.models.generateContent({
      model: params.model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: sheetBase64 } },
          { text: prompt },
        ],
      },
      config,
    });

  let response: Awaited<ReturnType<typeof request>>;
  try {
    response = await retryOperation(
      () => request(buildConfig(true)),
      params.onProgress,
      5,
      4000,
      params.signal
    );
  } catch (firstErr) {
    if (!isImageSizeRejection(firstErr)) {
      throw firstErr;
    }
    params.onProgress?.('模型不支援 imageSize，改用預設尺寸重試…');
    response = await retryOperation(
      () => request(buildConfig(false)),
      params.onProgress,
      5,
      4000,
      params.signal
    );
  }

  throwIfAborted(params.signal);
  const parts = response.candidates?.[0]?.content?.parts;
  for (const part of parts ?? []) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image data received for comic page');
}
