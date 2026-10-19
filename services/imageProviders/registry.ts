import { geminiImageProvider } from './geminiProvider';
import { openRouterImageProvider } from './openRouterProvider';
import type { ImageProvider, ImageProviderId } from './types';

const PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  gemini: geminiImageProvider,
  openrouter: openRouterImageProvider,
};

export function getImageProvider(id: ImageProviderId): ImageProvider {
  return PROVIDERS[id];
}
