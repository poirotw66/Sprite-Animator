export const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
export const HF_TOKEN_STORAGE_KEY = 'hf_token';

export interface StoredCredentials {
  apiKey: string;
  hfToken: string;
}

function read(storage: Storage, key: string): string {
  try {
    return storage.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

function write(storage: Storage, key: string, value: string): void {
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    // Credentials still remain available in React state when storage is blocked.
  }
}

/**
 * Loads credentials for this browser tab. Legacy localStorage values are moved
 * to sessionStorage once so upgrades do not unexpectedly sign users out while
 * long-lived, script-readable copies are removed.
 */
export function loadSessionCredentials(): StoredCredentials {
  const apiKey = read(sessionStorage, GEMINI_API_KEY_STORAGE_KEY)
    || read(localStorage, GEMINI_API_KEY_STORAGE_KEY);
  const hfToken = read(sessionStorage, HF_TOKEN_STORAGE_KEY)
    || read(localStorage, HF_TOKEN_STORAGE_KEY);

  write(sessionStorage, GEMINI_API_KEY_STORAGE_KEY, apiKey);
  write(sessionStorage, HF_TOKEN_STORAGE_KEY, hfToken);
  write(localStorage, GEMINI_API_KEY_STORAGE_KEY, '');
  write(localStorage, HF_TOKEN_STORAGE_KEY, '');

  return { apiKey, hfToken };
}

export function saveSessionCredentials(apiKey: string, hfToken: string): void {
  write(sessionStorage, GEMINI_API_KEY_STORAGE_KEY, apiKey.trim());
  write(sessionStorage, HF_TOKEN_STORAGE_KEY, hfToken.trim());
  // Always purge values written by older releases.
  write(localStorage, GEMINI_API_KEY_STORAGE_KEY, '');
  write(localStorage, HF_TOKEN_STORAGE_KEY, '');
}

export function getSessionHfToken(): string {
  return read(sessionStorage, HF_TOKEN_STORAGE_KEY);
}
