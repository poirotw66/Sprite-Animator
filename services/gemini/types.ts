/**
 * Shared types and constants for Gemini service modules.
 */

export type ProgressCallback = (status: string) => void;

/** Message thrown when API key is missing; UI can detect this to open Settings. */
export const API_KEY_MISSING_MESSAGE =
  'API Key is missing. Please add your key in Settings (gear icon).';
