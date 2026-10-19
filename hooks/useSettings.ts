import { useState, useEffect } from 'react';
import type { ImageResolution } from '../utils/constants';
import { getLocalDevelopmentGeminiApiKey } from '../utils/localDevelopmentGeminiApiKey';
import { loadSessionCredentials, saveSessionCredentials } from '../utils/credentialStorage';
import {
  defaultModelForProvider,
  defaultResolutionForProviderModel,
  isImageProviderId,
  resolutionsForModel,
  resolveModelForProvider,
  type ImageProviderId,
} from '../services/imageProviders';

const MODEL_STORAGE_KEY = 'gemini_model';
const PROVIDER_STORAGE_KEY = 'image_provider';
const OUTPUT_RESOLUTION_STORAGE_KEY = 'gemini_output_resolution';
const STYLE_PREVIEW_RESOLUTION_STORAGE_KEY = 'gemini_style_preview_resolution';

/** Map retired preview model ids to stable API names. */
const LEGACY_MODEL_IDS: Record<string, string> = {
  'gemini-3-pro-image-preview': 'gemini-3-pro-image',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image',
};

function resolveStoredProvider(stored: string | null): ImageProviderId {
  if (stored && isImageProviderId(stored)) return stored;
  return 'gemini';
}

export interface SaveSettingsArgs {
  apiKey: string;
  model: string;
  hfToken?: string;
  outputResolution?: ImageResolution;
  stylePreviewResolution?: ImageResolution;
  imageProvider?: ImageProviderId;
  openRouterApiKey?: string;
}

/**
 * Custom hook for managing application settings including API key and model selection.
 * Keys stay in sessionStorage (never bundled). Provider preference is in localStorage.
 */
export const useSettings = () => {
  const [apiKey, setApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [imageProvider, setImageProvider] = useState<ImageProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState(defaultModelForProvider('gemini'));
  const [outputResolution, setOutputResolution] = useState<ImageResolution>(
    defaultResolutionForProviderModel('gemini', defaultModelForProvider('gemini')),
  );
  const [stylePreviewResolution, setStylePreviewResolution] =
    useState<ImageResolution>('1K');
  const [hfToken, setHfToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const credentials = loadSessionCredentials();
    const storedProvider = resolveStoredProvider(
      localStorage.getItem(PROVIDER_STORAGE_KEY),
    );
    const storedModelRaw = localStorage.getItem(MODEL_STORAGE_KEY);
    const storedModelMigrated = storedModelRaw
      ? (LEGACY_MODEL_IDS[storedModelRaw] ?? storedModelRaw)
      : null;
    const storedResolution = localStorage.getItem(
      OUTPUT_RESOLUTION_STORAGE_KEY,
    ) as ImageResolution | null;
    const storedStylePreviewResolution = localStorage.getItem(
      STYLE_PREVIEW_RESOLUTION_STORAGE_KEY,
    ) as ImageResolution | null;

    if (credentials.apiKey) setApiKey(credentials.apiKey);
    if (credentials.openRouterApiKey) {
      setOpenRouterApiKey(credentials.openRouterApiKey);
    }
    if (credentials.hfToken) setHfToken(credentials.hfToken);

    setImageProvider(storedProvider);
    localStorage.setItem(PROVIDER_STORAGE_KEY, storedProvider);

    const model = resolveModelForProvider(storedProvider, storedModelMigrated);
    setSelectedModel(model);
    if (!storedModelRaw || model !== storedModelRaw) {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    }

    const allowed = resolutionsForModel(storedProvider, model);
    const resolution =
      storedResolution && allowed.includes(storedResolution)
        ? storedResolution
        : defaultResolutionForProviderModel(storedProvider, model);
    setOutputResolution(resolution);
    if (!storedResolution || !allowed.includes(storedResolution)) {
      localStorage.setItem(OUTPUT_RESOLUTION_STORAGE_KEY, resolution);
    }

    const stylePreviewResolution =
      storedStylePreviewResolution &&
      allowed.includes(storedStylePreviewResolution)
        ? storedStylePreviewResolution
        : ('1K' as ImageResolution);
    setStylePreviewResolution(stylePreviewResolution);
    if (
      !storedStylePreviewResolution ||
      !allowed.includes(storedStylePreviewResolution)
    ) {
      localStorage.setItem(
        STYLE_PREVIEW_RESOLUTION_STORAGE_KEY,
        stylePreviewResolution,
      );
    }

    const hasGemini =
      !!credentials.apiKey || !!getLocalDevelopmentGeminiApiKey();
    const hasOpenRouter = !!credentials.openRouterApiKey;
    if (storedProvider === 'openrouter' ? !hasOpenRouter : !hasGemini) {
      setShowSettings(true);
    }
  }, []);

  useEffect(() => {
    const allowed = resolutionsForModel(imageProvider, selectedModel);
    if (!allowed.includes(outputResolution)) {
      const fallback = defaultResolutionForProviderModel(
        imageProvider,
        selectedModel,
      );
      setOutputResolution(fallback);
      localStorage.setItem(OUTPUT_RESOLUTION_STORAGE_KEY, fallback);
    }
    if (!allowed.includes(stylePreviewResolution)) {
      setStylePreviewResolution('1K');
      localStorage.setItem(STYLE_PREVIEW_RESOLUTION_STORAGE_KEY, '1K');
    }
  }, [imageProvider, selectedModel, outputResolution, stylePreviewResolution]);

  const saveSettings = (args: SaveSettingsArgs) => {
    const provider = args.imageProvider ?? imageProvider;
    const trimmedKey = args.apiKey.trim();
    const trimmedOpenRouter = (args.openRouterApiKey ?? openRouterApiKey).trim();
    const trimmedToken = (args.hfToken ?? '').trim();
    const model = resolveModelForProvider(provider, args.model);
    const allowed = resolutionsForModel(provider, model);
    const res =
      args.outputResolution != null && allowed.includes(args.outputResolution)
        ? args.outputResolution
        : defaultResolutionForProviderModel(provider, model);
    const previewRes =
      args.stylePreviewResolution != null &&
      allowed.includes(args.stylePreviewResolution)
        ? args.stylePreviewResolution
        : ('1K' as ImageResolution);

    setApiKey(trimmedKey);
    setOpenRouterApiKey(trimmedOpenRouter);
    setImageProvider(provider);
    setSelectedModel(model);
    setOutputResolution(res);
    setStylePreviewResolution(previewRes);
    setHfToken(trimmedToken);

    saveSessionCredentials(trimmedKey, trimmedToken, trimmedOpenRouter);

    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
    localStorage.setItem(OUTPUT_RESOLUTION_STORAGE_KEY, res);
    localStorage.setItem(STYLE_PREVIEW_RESOLUTION_STORAGE_KEY, previewRes);
    setShowSettings(false);
  };

  /** Key for the currently selected image provider (Sprite Animator). */
  const getEffectiveApiKey = (): string => {
    if (imageProvider === 'openrouter') {
      return openRouterApiKey.trim();
    }
    const userKey = apiKey.trim();
    return userKey || getLocalDevelopmentGeminiApiKey();
  };

  /** Always Gemini — used by LINE sticker / comic paths. */
  const getEffectiveGeminiApiKey = (): string => {
    const userKey = apiKey.trim();
    return userKey || getLocalDevelopmentGeminiApiKey();
  };

  return {
    apiKey,
    setApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    imageProvider,
    setImageProvider,
    selectedModel,
    setSelectedModel,
    outputResolution,
    setOutputResolution,
    stylePreviewResolution,
    setStylePreviewResolution,
    hfToken,
    setHfToken,
    showSettings,
    setShowSettings,
    saveSettings,
    getEffectiveApiKey,
    getEffectiveGeminiApiKey,
  };
};
