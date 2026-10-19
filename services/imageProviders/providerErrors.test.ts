import { describe, expect, it } from 'vitest';
import { formatImageProviderError } from './providerErrors';

describe('formatImageProviderError', () => {
  it('clarifies OpenRouter rate limits for the UI', () => {
    const err = formatImageProviderError(
      'openrouter',
      new Error('OpenRouter rate limit (429): Too Many Requests'),
    );
    expect(err.message).toMatch(/OpenRouter rate limit/i);
    expect(err.message).toMatch(/retry|Settings/i);
  });

  it('hints when image-to-image may be unsupported', () => {
    const err = formatImageProviderError(
      'openrouter',
      new Error('model does not support input_reference images'),
    );
    expect(err.message).toMatch(/image-to-image/i);
  });
});
