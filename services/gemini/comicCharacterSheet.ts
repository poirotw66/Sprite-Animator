import { buildCharacterRefPrompt, resolveStyleBlock } from '../../utils/characterRefPrompt';
import { throwIfAborted } from '../../utils/abort';
import { dataUrlToBase64, loadBundledImageAsDataUrl } from '../../utils/loadBundledImage';
import { generateCharacterRefImage } from './characterRefImage';
import { API_KEY_MISSING_MESSAGE, type ProgressCallback } from './types';

const LAYOUT_REF_URL = new URL('../../reference/comic/model-sheet-layout.png', import.meta.url).href;

let cachedLayoutDataUrl: string | null = null;

async function getLayoutRefDataUrl(): Promise<string> {
  if (!cachedLayoutDataUrl) {
    cachedLayoutDataUrl = await loadBundledImageAsDataUrl(LAYOUT_REF_URL);
  }
  return cachedLayoutDataUrl;
}

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

  const layoutDataUrl = await getLayoutRefDataUrl();
  const prompt = buildCharacterRefPrompt({
    concept: params.characterConcept,
    styleKey: params.styleKey,
    customStyle: params.customStyle,
    characterName: undefined,
  });

  const identityBase64 = params.referenceImage
    ? dataUrlToBase64(params.referenceImage)
    : undefined;

  params.onProgress?.('正在生成角色設定圖…');

  return generateCharacterRefImage({
    apiKey: params.apiKey,
    prompt,
    layoutRefBase64: dataUrlToBase64(layoutDataUrl),
    layoutRefMimeType: 'image/png',
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
