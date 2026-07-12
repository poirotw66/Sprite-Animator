import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHROMA_KEY_ALGORITHM,
  DEFAULT_MODEL,
  DEFAULT_OUTPUT_RESOLUTION,
  defaultResolutionForModel,
} from './constants';

describe('sticker generation defaults', () => {
  it('uses flash-image, 2K, and legacy chroma by default', () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.1-flash-image');
    expect(DEFAULT_OUTPUT_RESOLUTION).toBe('2K');
    expect(DEFAULT_CHROMA_KEY_ALGORITHM).toBe('legacy');
    expect(defaultResolutionForModel(DEFAULT_MODEL)).toBe('2K');
  });

  it('falls back to 1K when model does not support 2K', () => {
    expect(defaultResolutionForModel('gemini-3.1-flash-lite-image')).toBe('1K');
  });
});
