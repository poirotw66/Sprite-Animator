import { useState, useEffect } from 'react';
import type { ImageResolution } from '../utils/constants';
import { getLocalDevelopmentGeminiApiKey } from '../utils/localDevelopmentGeminiApiKey';
import { loadSessionCredentials, saveSessionCredentials } from '../utils/credentialStorage';
import type { ImageProviderId } from '../services/imageProviders';
import {
  loadPreferredImageProvider,
  loadProviderSettings,
  normalizeProviderSettings,
  savePreferredImageProvider,
  saveProviderSettings,
  type ProviderSettings,
} from '../utils/providerSettingsStorage';

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
 * Provider-specific settings and session-only credentials. A fixed provider lets
 * Gemini-only tools share Gemini preferences without changing animation routing.
 */
export const useSettings = (fixedProvider?: ImageProviderId) => {
  const [apiKey, setApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [imageProvider, setActiveProvider] = useState<ImageProviderId>(
    () => fixedProvider ?? loadPreferredImageProvider(),
  );
  const [profiles, setProfiles] = useState<Record<ImageProviderId, ProviderSettings>>(() => ({
    gemini: loadProviderSettings('gemini'),
    openrouter: loadProviderSettings('openrouter'),
  }));
  const [hfToken, setHfToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const activeProfile = profiles[imageProvider];

  useEffect(() => {
    const credentials = loadSessionCredentials();
    setApiKey(credentials.apiKey);
    setOpenRouterApiKey(credentials.openRouterApiKey);
    setHfToken(credentials.hfToken);
    const provider = fixedProvider ?? loadPreferredImageProvider();
    const hasKey = provider === 'openrouter'
      ? !!credentials.openRouterApiKey
      : !!credentials.apiKey || !!getLocalDevelopmentGeminiApiKey();
    setShowSettings(!hasKey);
    // Persist validated legacy migration without rewriting another tool's provider.
    saveProviderSettings('gemini', loadProviderSettings('gemini'));
    saveProviderSettings('openrouter', loadProviderSettings('openrouter'));
  }, [fixedProvider]);

  const setImageProvider = (provider: ImageProviderId) => {
    setActiveProvider(fixedProvider ?? provider);
  };

  const updateProfile = (patch: Partial<ProviderSettings>) => {
    setProfiles((previous) => ({
      ...previous,
      [imageProvider]: normalizeProviderSettings(imageProvider, {
        ...previous[imageProvider],
        ...patch,
      }),
    }));
  };

  const setSelectedModel = (model: string) => updateProfile({ model });
  const setOutputResolution = (outputResolution: ImageResolution) => updateProfile({ outputResolution });
  const setStylePreviewResolution = (stylePreviewResolution: ImageResolution) => updateProfile({ stylePreviewResolution });

  const saveSettings = (args: SaveSettingsArgs) => {
    const provider = fixedProvider ?? args.imageProvider ?? imageProvider;
    const trimmedKey = args.apiKey.trim();
    const trimmedOpenRouter = (args.openRouterApiKey ?? openRouterApiKey).trim();
    const trimmedToken = (args.hfToken ?? hfToken).trim();
    const profile = normalizeProviderSettings(provider, {
      model: args.model,
      outputResolution: args.outputResolution,
      stylePreviewResolution: args.stylePreviewResolution,
    });

    setApiKey(trimmedKey);
    setOpenRouterApiKey(trimmedOpenRouter);
    setHfToken(trimmedToken);
    setActiveProvider(provider);
    setProfiles((previous) => ({ ...previous, [provider]: profile }));
    saveSessionCredentials(trimmedKey, trimmedToken, trimmedOpenRouter);
    saveProviderSettings(provider, profile);
    if (!fixedProvider) savePreferredImageProvider(provider);
    setShowSettings(false);
  };

  const getEffectiveGeminiApiKey = (): string => apiKey.trim() || getLocalDevelopmentGeminiApiKey();
  const getEffectiveApiKey = (): string => imageProvider === 'openrouter'
    ? openRouterApiKey.trim()
    : getEffectiveGeminiApiKey();

  return {
    apiKey,
    setApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    imageProvider,
    setImageProvider,
    selectedModel: activeProfile.model,
    setSelectedModel,
    outputResolution: activeProfile.outputResolution,
    setOutputResolution,
    stylePreviewResolution: activeProfile.stylePreviewResolution,
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
