import type { ImageResolution } from '../../utils/constants';
import {
  DEFAULT_MODEL,
  MODEL_RESOLUTIONS,
  SUPPORTED_MODELS,
  defaultResolutionForModel,
} from '../../utils/constants';
import type { ImageProviderId } from './types';

/** Curated OpenRouter image-capable models (image output; most accept image refs). */
export const OPENROUTER_IMAGE_MODELS = [
  'google/gemini-2.5-flash-image',
  'google/gemini-3-pro-image',
  'openai/gpt-image-1',
  'black-forest-labs/flux.2-pro',
] as const;

export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_IMAGE_MODELS[0];

export const OPENROUTER_MODEL_RESOLUTIONS: Record<string, ImageResolution[]> = {
  'google/gemini-2.5-flash-image': ['1K'],
  'google/gemini-3-pro-image': ['1K', '2K', '4K'],
  'openai/gpt-image-1': ['1K', '2K'],
  'black-forest-labs/flux.2-pro': ['1K', '2K'],
};

export function modelsForProvider(provider: ImageProviderId): readonly string[] {
  return provider === 'openrouter' ? OPENROUTER_IMAGE_MODELS : SUPPORTED_MODELS;
}

export function defaultModelForProvider(provider: ImageProviderId): string {
  return provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL;
}

export function resolutionsForModel(
  provider: ImageProviderId,
  model: string,
): ImageResolution[] {
  if (provider === 'openrouter') {
    return OPENROUTER_MODEL_RESOLUTIONS[model] ?? ['1K'];
  }
  return MODEL_RESOLUTIONS[model] ?? ['1K'];
}

export function defaultResolutionForProviderModel(
  provider: ImageProviderId,
  model: string,
): ImageResolution {
  const allowed = resolutionsForModel(provider, model);
  if (provider === 'gemini') {
    return defaultResolutionForModel(model);
  }
  return allowed.includes('1K') ? '1K' : (allowed[0] as ImageResolution);
}

export function resolveModelForProvider(
  provider: ImageProviderId,
  storedModel: string | null,
): string {
  const allowed = modelsForProvider(provider);
  if (storedModel && (allowed as readonly string[]).includes(storedModel)) {
    return storedModel;
  }
  return defaultModelForProvider(provider);
}
