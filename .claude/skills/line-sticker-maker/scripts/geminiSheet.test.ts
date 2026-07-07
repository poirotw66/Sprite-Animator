import { describe, expect, it } from 'vitest';

import { resolveModelForGuidedGridTemplate } from './geminiSheet.mts';

describe('resolveModelForGuidedGridTemplate', () => {
  it('upgrades flash-lite to flash-image for guided mode', () => {
    expect(resolveModelForGuidedGridTemplate('gemini-3.1-flash-lite-image', 'guided')).toBe(
      'gemini-3.1-flash-image'
    );
  });

  it('keeps flash-image unchanged for guided mode', () => {
    expect(resolveModelForGuidedGridTemplate('gemini-3.1-flash-image', 'guided')).toBe(
      'gemini-3.1-flash-image'
    );
  });

  it('keeps flash-lite for solid template mode', () => {
    expect(resolveModelForGuidedGridTemplate('gemini-3.1-flash-lite-image', 'solid')).toBe(
      'gemini-3.1-flash-lite-image'
    );
  });
});
