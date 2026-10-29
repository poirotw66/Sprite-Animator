import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultModelForProvider } from '../services/imageProviders';
import {
  loadPreferredImageProvider,
  loadProviderSettings,
  normalizeProviderSettings,
  savePreferredImageProvider,
  saveProviderSettings,
} from './providerSettingsStorage';

function memoryStorage(): Storage {
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

describe('provider-specific settings storage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('migrates a legacy Gemini model and resolution only into Gemini', () => {
    localStorage.setItem('gemini_model', 'gemini-3-pro-image');
    localStorage.setItem('gemini_output_resolution', '4K');
    localStorage.setItem('gemini_style_preview_resolution', '2K');
    expect(loadProviderSettings('gemini')).toEqual({
      model: 'gemini-3-pro-image', outputResolution: '4K', stylePreviewResolution: '2K',
    });
    expect(loadProviderSettings('openrouter').model).toBe(defaultModelForProvider('openrouter'));
    expect(loadProviderSettings('openrouter').outputResolution).toBe('1K');
  });

  it('does not interpret legacy OpenRouter slugs as Gemini models', () => {
    localStorage.setItem('image_provider', 'openrouter');
    localStorage.setItem('gemini_model', 'google/gemini-3-pro-image');
    localStorage.setItem('gemini_output_resolution', '4K');
    expect(loadPreferredImageProvider()).toBe('openrouter');
    expect(loadProviderSettings('openrouter').model).toBe('google/gemini-3-pro-image');
    expect(loadProviderSettings('openrouter').outputResolution).toBe('4K');
    expect(loadProviderSettings('gemini').model).toBe(defaultModelForProvider('gemini'));
  });

  it('preserves retired Gemini preview-model preferences', () => {
    localStorage.setItem('gemini_model', 'gemini-3-pro-image-preview');
    localStorage.setItem('gemini_output_resolution', '2K');
    expect(loadProviderSettings('gemini').model).toBe('gemini-3-pro-image');
    expect(loadProviderSettings('gemini').outputResolution).toBe('2K');
  });

  it('saves both profiles independently without changing animation routing', () => {
    savePreferredImageProvider('openrouter');
    saveProviderSettings('openrouter', {
      model: 'google/gemini-3-pro-image', outputResolution: '4K', stylePreviewResolution: '1K',
    });
    saveProviderSettings('gemini', {
      model: 'gemini-2.5-flash-image', outputResolution: '1K', stylePreviewResolution: '1K',
    });
    expect(loadPreferredImageProvider()).toBe('openrouter');
    expect(loadProviderSettings('openrouter').outputResolution).toBe('4K');
    expect(loadProviderSettings('gemini').model).toBe('gemini-2.5-flash-image');
  });

  it('validates stored model names and resolutions instead of trusting JSON', () => {
    localStorage.setItem('image_provider_settings_v1_gemini', JSON.stringify({
      model: 'openai/gpt-image-1', outputResolution: 'bogus', stylePreviewResolution: 100,
    }));
    expect(loadProviderSettings('gemini')).toEqual(normalizeProviderSettings('gemini', {}));
    expect(normalizeProviderSettings('gemini', {
      model: 'gemini-2.5-flash-image', outputResolution: '4K', stylePreviewResolution: '2K',
    })).toEqual({ model: 'gemini-2.5-flash-image', outputResolution: '1K', stylePreviewResolution: '1K' });
  });

  it('recovers a malformed scoped profile from valid legacy preferences', () => {
    localStorage.setItem('image_provider_settings_v1_gemini', '{broken');
    localStorage.setItem('gemini_model', 'gemini-3-pro-image');
    expect(loadProviderSettings('gemini').model).toBe('gemini-3-pro-image');
  });

  it('keeps settings usable when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('Storage blocked'); },
      setItem: () => { throw new Error('Storage blocked'); },
    });
    expect(loadPreferredImageProvider()).toBe('gemini');
    expect(() => savePreferredImageProvider('openrouter')).not.toThrow();
    expect(() => saveProviderSettings('gemini', loadProviderSettings('gemini'))).not.toThrow();
  });
});
