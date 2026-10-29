import type { ImageResolution } from './constants';
import {
  defaultResolutionForProviderModel,
  isImageProviderId,
  modelsForProvider,
  resolutionsForModel,
  resolveModelForProvider,
  type ImageProviderId,
} from '../services/imageProviders';

const PROVIDER_STORAGE_KEY = 'image_provider';
const SETTINGS_PREFIX = 'image_provider_settings_v1_';
const LEGACY_MODEL_IDS: Record<string, string> = {
  'gemini-3-pro-image-preview': 'gemini-3-pro-image',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image',
};

export interface ProviderSettings {
  model: string;
  outputResolution: ImageResolution;
  stylePreviewResolution: ImageResolution;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The active settings remain usable when browser storage is unavailable.
  }
}

export function loadPreferredImageProvider(): ImageProviderId {
  const stored = read(PROVIDER_STORAGE_KEY);
  return stored && isImageProviderId(stored) ? stored : 'gemini';
}

export function savePreferredImageProvider(provider: ImageProviderId): void {
  write(PROVIDER_STORAGE_KEY, provider);
}

export function normalizeProviderSettings(
  provider: ImageProviderId,
  value: Partial<ProviderSettings>,
): ProviderSettings {
  const rawModel = typeof value.model === 'string' ? value.model : null;
  const model = resolveModelForProvider(
    provider,
    rawModel ? (LEGACY_MODEL_IDS[rawModel] ?? rawModel) : null,
  );
  const allowed = resolutionsForModel(provider, model);
  const fallback = defaultResolutionForProviderModel(provider, model);
  return {
    model,
    outputResolution: allowed.includes(value.outputResolution as ImageResolution)
      ? value.outputResolution as ImageResolution
      : fallback,
    stylePreviewResolution: allowed.includes(value.stylePreviewResolution as ImageResolution)
      ? value.stylePreviewResolution as ImageResolution
      : fallback,
  };
}

/** Import legacy preferences only into the provider that actually owns the model. */
export function loadProviderSettings(provider: ImageProviderId): ProviderSettings {
  const stored = read(SETTINGS_PREFIX + provider);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return normalizeProviderSettings(provider, parsed);
      }
    } catch {
      // A damaged profile can still recover from the older preference keys.
    }
  }

  const rawModel = read('gemini_model');
  const legacyModel = rawModel ? (LEGACY_MODEL_IDS[rawModel] ?? rawModel) : null;
  if (legacyModel && (modelsForProvider(provider) as readonly string[]).includes(legacyModel)) {
    return normalizeProviderSettings(provider, {
      model: legacyModel,
      outputResolution: read('gemini_output_resolution') as ImageResolution,
      stylePreviewResolution: read('gemini_style_preview_resolution') as ImageResolution,
    });
  }
  return normalizeProviderSettings(provider, {});
}

export function saveProviderSettings(provider: ImageProviderId, settings: ProviderSettings): void {
  write(SETTINGS_PREFIX + provider, JSON.stringify(normalizeProviderSettings(provider, settings)));
}
