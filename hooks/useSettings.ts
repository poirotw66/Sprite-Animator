import { useState, useEffect } from 'react';
import { DEFAULT_MODEL, SUPPORTED_MODELS } from '../utils/constants';

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const MODEL_STORAGE_KEY = 'gemini_model';
const HF_TOKEN_STORAGE_KEY = 'hf_token';

/**
 * Custom hook for managing application settings including API key and model selection.
 * Handles localStorage persistence and environment variable fallback.
 * 
 * @returns Object containing settings state and management functions
 * 
 * @example
 * ```typescript
 * const {
 *   apiKey,
 *   setApiKey,
 *   selectedModel,
 *   showSettings,
 *   saveSettings,
 *   getEffectiveApiKey
 * } = useSettings();
 * ```
 */
export const useSettings = () => {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [hfToken, setHfToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Load settings from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    const storedHfToken = localStorage.getItem(HF_TOKEN_STORAGE_KEY);

    if (storedKey) setApiKey(storedKey);
    if (storedHfToken) setHfToken(storedHfToken);

    // Validate stored model or force update to the recommended one
    if (storedModel && (SUPPORTED_MODELS as readonly string[]).includes(storedModel)) {
      setSelectedModel(storedModel);
    } else {
      // Force default if stored model is old or invalid
      setSelectedModel(DEFAULT_MODEL);
      localStorage.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL);
    }

    // If no key is found, show settings automatically
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!storedKey && !envKey) {
      setShowSettings(true);
    }
  }, []);

  const saveSettings = (key: string, model: string, token: string = '') => {
    const trimmedKey = key.trim();
    const trimmedToken = token.trim();
    setApiKey(trimmedKey);
    setSelectedModel(model);
    setHfToken(trimmedToken);

    if (trimmedKey) {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }

    if (trimmedToken) {
      localStorage.setItem(HF_TOKEN_STORAGE_KEY, trimmedToken);
    } else {
      localStorage.removeItem(HF_TOKEN_STORAGE_KEY);
    }

    localStorage.setItem(MODEL_STORAGE_KEY, model);
    setShowSettings(false);
  };

  const getEffectiveApiKey = (): string => {
    const userKey = apiKey.trim();
    return userKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  };

  return {
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    hfToken,
    setHfToken,
    showSettings,
    setShowSettings,
    saveSettings,
    getEffectiveApiKey,
  };
};
