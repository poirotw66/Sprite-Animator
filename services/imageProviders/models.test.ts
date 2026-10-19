import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENROUTER_MODEL,
  defaultModelForProvider,
  modelsForProvider,
  resolveModelForProvider,
} from './models';

describe('image provider model helpers', () => {
  it('returns Gemini models for gemini provider', () => {
    const models = modelsForProvider('gemini');
    expect(models).toContain('gemini-3.1-flash-image');
    expect(models.some((m) => m.startsWith('google/'))).toBe(false);
  });

  it('returns OpenRouter slugs for openrouter provider', () => {
    const models = modelsForProvider('openrouter');
    expect(models).toContain(DEFAULT_OPENROUTER_MODEL);
    expect(models.every((m) => m.includes('/'))).toBe(true);
  });

  it('falls back to the provider default when stored model is foreign', () => {
    expect(resolveModelForProvider('openrouter', 'gemini-3.1-flash-image')).toBe(
      defaultModelForProvider('openrouter'),
    );
    expect(resolveModelForProvider('gemini', 'google/gemini-2.5-flash-image')).toBe(
      defaultModelForProvider('gemini'),
    );
  });
});
