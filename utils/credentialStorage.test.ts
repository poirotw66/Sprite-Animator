import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GEMINI_API_KEY_STORAGE_KEY,
  HF_TOKEN_STORAGE_KEY,
  OPENROUTER_API_KEY_STORAGE_KEY,
  getSessionHfToken,
  loadSessionCredentials,
  saveSessionCredentials,
} from './credentialStorage';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('credentialStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
  });

  it('migrates legacy persistent credentials into the current session', () => {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, ' legacy-key ');
    localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, ' legacy-or ');
    localStorage.setItem(HF_TOKEN_STORAGE_KEY, ' legacy-token ');

    expect(loadSessionCredentials()).toEqual({
      apiKey: 'legacy-key',
      openRouterApiKey: 'legacy-or',
      hfToken: 'legacy-token',
    });
    expect(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(HF_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBe('legacy-key');
    expect(sessionStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY)).toBe('legacy-or');
    expect(getSessionHfToken()).toBe('legacy-token');
  });

  it('stores new credentials for the session and clears legacy copies', () => {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, 'old');
    saveSessionCredentials(' new-key ', ' new-token ', ' or-key ');

    expect(sessionStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBe('new-key');
    expect(sessionStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY)).toBe('or-key');
    expect(sessionStorage.getItem(HF_TOKEN_STORAGE_KEY)).toBe('new-token');
    expect(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY)).toBeNull();
  });
});
