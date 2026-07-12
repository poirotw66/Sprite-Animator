import { describe, expect, it } from 'vitest';

import {
  LINE_STICKER_PHRASE_SET_SIZE,
  parsePhraseSetJson,
} from './lineStickerPhraseSetFormat';

describe('lineStickerPhraseSetFormat', () => {
  it('does not pad 40-slot set mode to 48', () => {
    const phrases = Array.from({ length: LINE_STICKER_PHRASE_SET_SIZE }, (_, i) =>
      i % 5 === 0 ? '' : `詞${i}`
    );
    const actionDescs = phrases.map((p, i) =>
      p ? `動作${i}` : '【無字純動作】純表情'
    );
    const raw = JSON.stringify({
      format: 'line-sticker-phrase-set',
      version: 1,
      mode: 'set',
      phrases,
      actionDescs,
    });
    const parsed = parsePhraseSetJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.phrases.length).toBe(40);
    expect(parsed!.actionDescs?.length).toBe(40);
  });

  it('rejects set mode with more than 40 slots', () => {
    const raw = JSON.stringify({
      format: 'line-sticker-phrase-set',
      version: 1,
      mode: 'set',
      phrases: Array(48).fill('好'),
      actionDescs: Array(48).fill('wave'),
    });
    expect(parsePhraseSetJson(raw)).toBeNull();
  });
});
