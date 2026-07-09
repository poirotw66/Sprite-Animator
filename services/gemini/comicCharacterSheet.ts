import { buildComicCharacterRefPrompt, resolveStyleBlock } from '../../utils/characterRefPrompt';
import { throwIfAborted } from '../../utils/abort';
import { dataUrlToBase64 } from '../../utils/loadBundledImage';
import { generateCharacterRefImage } from './characterRefImage';
import { API_KEY_MISSING_MESSAGE, type ProgressCallback } from './types';

export async function generateComicCharacterSheet(params: {
  apiKey: string;
  model: string;
  resolution: string;
  styleKey: string;
  customStyle?: string;
  characterConcept: string;
  referenceImage?: string | null;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}): Promise<string> {
  if (!params.apiKey) {
    throw new Error(API_KEY_MISSING_MESSAGE);
  }
  throwIfAborted(params.signal);

  const hasIdentityReference = Boolean(params.referenceImage);
  const prompt = buildComicCharacterRefPrompt({
    concept: params.characterConcept,
    styleKey: params.styleKey,
    customStyle: params.customStyle,
    hasIdentityReference,
  });

  const identityBase64 = params.referenceImage
    ? dataUrlToBase64(params.referenceImage)
    : undefined;

  params.onProgress?.('正在生成角色設定圖…');

  // ponytail: do NOT attach reference/comic/model-sheet-layout.png — it is a full otter
  // model sheet; Gemini copies the species despite "structure only" prompt text.
  return generateCharacterRefImage({
    apiKey: params.apiKey,
    prompt,
    identityRefBase64: identityBase64,
    identityRefMimeType: identityBase64 ? 'image/png' : undefined,
    model: params.model,
    resolution: params.resolution,
    aspectRatio: '1:1',
    onStatus: params.onProgress,
  });
}

export function resolveComicStyleBlock(styleKey: string, customStyle?: string): string {
  return resolveStyleBlock(styleKey, customStyle);
}
