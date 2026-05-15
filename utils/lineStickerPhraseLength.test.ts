import { describe, expect, it } from 'vitest';
import { clampStickerPhrase } from './lineStickerPhraseLength';

describe('clampStickerPhrase', () => {
  it('truncates Chinese to 5 characters', () => {
    expect(clampStickerPhrase('小朋友才做選擇', 'Traditional Chinese')).toBe('小朋友才做');
    expect(clampStickerPhrase('早安', 'Traditional Chinese')).toBe('早安');
  });

  it('truncates Japanese to 5 characters', () => {
    expect(clampStickerPhrase('おはようございます', 'Japanese')).toBe('おはようご');
  });

  it('limits English to 3 words', () => {
    expect(clampStickerPhrase('see you later alligator', 'English')).toBe('see you later');
    expect(clampStickerPhrase('OK', 'English')).toBe('OK');
  });
});
