import { useState, useEffect } from 'react';
import { DEFAULT_MODEL, MODEL_RESOLUTIONS, SUPPORTED_MODELS } from '../utils/constants';
import type { ImageResolution } from '../utils/constants';

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const MODEL_STORAGE_KEY = 'gemini_model';
const HF_TOKEN_STORAGE_KEY = 'hf_token';
const OUTPUT_RESOLUTION_STORAGE_KEY = 'gemini_output_resolution';

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
  const [outputResolution, setOutputResolution] = useState<ImageResolution>('1K');
  const [hfToken, setHfToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Load settings from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    const storedHfToken = localStorage.getItem(HF_TOKEN_STORAGE_KEY);
    const storedResolution = localStorage.getItem(OUTPUT_RESOLUTION_STORAGE_KEY) as ImageResolution | null;

    if (storedKey) setApiKey(storedKey);
    if (storedHfToken) setHfToken(storedHfToken);

    // Validate stored model or force update to the recommended one
    let model = DEFAULT_MODEL;
    if (storedModel && (SUPPORTED_MODELS as readonly string[]).includes(storedModel)) {
      model = storedModel;
      setSelectedModel(storedModel);
    } else {
      setSelectedModel(DEFAULT_MODEL);
      localStorage.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL);
    }

    // Output resolution: must be allowed for current model (2.5 Flash = 1K only; 3 Pro = 1K/2K/4K)
    const allowed = MODEL_RESOLUTIONS[model] ?? ['1K'];
    const resolution = storedResolution && allowed.includes(storedResolution) ? storedResolution : (allowed[0] as ImageResolution);
    setOutputResolution(resolution);
    if (!storedResolution || !allowed.includes(storedResolution)) {
      localStorage.setItem(OUTPUT_RESOLUTION_STORAGE_KEY, resolution);
    }

    // If no key is found, show settings automatically
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!storedKey && !envKey) {
      setShowSettings(true);
    }
  }, []);

  // When model changes, clamp resolution to model support (e.g. switch to 2.5 Flash -> 1K only)
  useEffect(() => {
    const allowed = MODEL_RESOLUTIONS[selectedModel] ?? ['1K'];
    if (!allowed.includes(outputResolution)) {
      setOutputResolution(allowed[0] as ImageResolution);
      localStorage.setItem(OUTPUT_RESOLUTION_STORAGE_KEY, allowed[0]);
    }
  }, [selectedModel]);

  const saveSettings = (key: string, model: string, token: string = '', resolution?: ImageResolution) => {
    const trimmedKey = key.trim();
    const trimmedToken = token.trim();
    const allowed = MODEL_RESOLUTIONS[model] ?? ['1K'];
    const res = resolution != null && allowed.includes(resolution) ? resolution : (allowed[0] as ImageResolution);

    setApiKey(trimmedKey);
    setSelectedModel(model);
    setOutputResolution(res);
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
    localStorage.setItem(OUTPUT_RESOLUTION_STORAGE_KEY, res);
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
    outputResolution,
    setOutputResolution,
    hfToken,
    setHfToken,
    showSettings,
    setShowSettings,
    saveSettings,
    getEffectiveApiKey,
  };
};
