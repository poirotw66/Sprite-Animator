import { describe, expect, it } from 'vitest';

import {
  buildGeminiSheetContentParts,
  resolveModelForGuidedGridTemplate,
} from './geminiSheet.mts';

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

describe('buildGeminiSheetContentParts', () => {
  const image = (name: string) => ({ base64: name, mimeType: 'image/png' });

  it('keeps every reference attachment in guided mode and puts the canvas first', () => {
    const parts = buildGeminiSheetContentParts({
      referenceBase64: 'primary',
      referenceMimeType: 'image/png',
      companionReference: image('companion'),
      styleAnchor: image('style'),
      gridTemplate: image('grid'),
      guidedCanvas: true,
      prompt: 'prompt',
    });
    expect(parts.map((part) => part.inlineData?.data ?? part.text)).toEqual([
      'grid', 'primary', 'companion', 'style', 'prompt',
    ]);
  });

  it('keeps the solid canvas after all character/style references', () => {
    const parts = buildGeminiSheetContentParts({
      referenceBase64: 'primary',
      referenceMimeType: 'image/png',
      companionReference: image('companion'),
      styleAnchor: image('style'),
      gridTemplate: image('grid'),
      guidedCanvas: false,
      prompt: 'prompt',
    });
    expect(parts.map((part) => part.inlineData?.data ?? part.text)).toEqual([
      'primary', 'companion', 'style', 'grid', 'prompt',
    ]);
  });
});
