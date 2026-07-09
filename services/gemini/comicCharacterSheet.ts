import { buildComicCharacterRefPrompt, resolveStyleBlock } from '../../utils/characterRefPrompt';
import { throwIfAborted } from '../../utils/abort';
import { dataUrlToBase64, parseDataUrlMime } from '../../utils/dataUrl';
import { resolveComicSheetReferenceImage } from '../../utils/comicSheetInput';
import type { ComicProject } from '../../utils/comicPanelSchema';
import { generateCharacterRefImage } from './characterRefImage';
import { API_KEY_MISSING_MESSAGE, type ProgressCallback } from './types';

export async function generateComicCharacterSheet(params: {
  apiKey: string;
  model: string;
  resolution: string;
  project: ComicProject;
  customStyle?: string;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}): Promise<string> {
  if (!params.apiKey) {
    throw new Error(API_KEY_MISSING_MESSAGE);
  }
  throwIfAborted(params.signal);

  const referenceImage = resolveComicSheetReferenceImage(params.project);
  const hasIdentityReference = Boolean(referenceImage);

  if (params.project.sourceMode === 'upload' && !referenceImage) {
    throw new Error('Upload a reference image before generating the character sheet.');
  }

  if (!hasIdentityReference && !params.project.characterConcept.trim()) {
    throw new Error('Need character concept or reference image');
  }

  const prompt = buildComicCharacterRefPrompt({
    concept: params.project.characterConcept,
    styleKey: params.project.styleKey,
    customStyle: params.customStyle,
    hasIdentityReference,
  });

  const identityBase64 = referenceImage ? dataUrlToBase64(referenceImage) : undefined;
  const identityMime = referenceImage ? parseDataUrlMime(referenceImage) : undefined;

  params.onProgress?.('正在生成角色設定圖…');

  return generateCharacterRefImage({
    apiKey: params.apiKey,
    prompt,
    identityRefBase64: identityBase64,
    identityRefMimeType: identityMime,
    model: params.model,
    resolution: params.resolution,
    aspectRatio: '1:1',
    onStatus: params.onProgress,
  });
}

export function resolveComicStyleBlock(styleKey: string, customStyle?: string): string {
  return resolveStyleBlock(styleKey, customStyle);
}
