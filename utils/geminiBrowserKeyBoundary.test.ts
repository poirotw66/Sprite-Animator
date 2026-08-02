import { describe, expect, it } from 'vitest';
import { resolveLocalDevelopmentGeminiApiKey } from './geminiBrowserKeyBoundary';

describe('resolveLocalDevelopmentGeminiApiKey', () => {
  it('never supplies an API key to a browser build', () => {
    expect(
      resolveLocalDevelopmentGeminiApiKey('build', {
        GEMINI_API_KEY: 'build-only-value',
      }),
    ).toBe('');
  });

  it('allows the non-public GEMINI_API_KEY only for the local dev server', () => {
    expect(
      resolveLocalDevelopmentGeminiApiKey('serve', {
        GEMINI_API_KEY: '  local-dev-value  ',
      }),
    ).toBe('local-dev-value');
  });

  it('does not use VITE-prefixed variables as an API-key source', () => {
    const env = {
      VITE_GEMINI_API_KEY: 'public-build-value',
    } as { GEMINI_API_KEY?: string };

    expect(resolveLocalDevelopmentGeminiApiKey('serve', env)).toBe('');
  });
});
