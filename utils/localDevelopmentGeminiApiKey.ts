/**
 * The Vite config defines this value only for `vite dev`. Production bundles
 * always receive an empty string, so browser users must provide their own key.
 */
export function getLocalDevelopmentGeminiApiKey(): string {
  if (!import.meta.env.DEV) {
    return '';
  }

  return import.meta.env.LOCAL_DEV_GEMINI_API_KEY?.trim() ?? '';
}
