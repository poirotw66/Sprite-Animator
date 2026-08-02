import { describe, expect, it } from 'vitest';

import {
  PHRASE_SET_FORMAT,
  PHRASE_SET_VERSION,
  type LineStickerPhraseSetJson,
} from './lineStickerPhraseSetFormat';
import { planLineStickerPhraseSetImport } from './lineStickerPhraseSetImport';

describe('planLineStickerPhraseSetImport', () => {
  it('keeps a single-sheet grid and fills omitted action descriptions', () => {
    const phraseSet: LineStickerPhraseSetJson = {
      format: PHRASE_SET_FORMAT,
      version: PHRASE_SET_VERSION,
      mode: 'single',
      gridCols: 3,
      gridRows: 2,
      phrases: ['早安', '晚安', '謝謝', '收到', '等等', '加油'],
    };

    expect(planLineStickerPhraseSetImport(phraseSet)).toEqual({
      mode: 'single',
      gridCols: 3,
      gridRows: 2,
      phrases: phraseSet.phrases,
      actionDescs: ['', '', '', '', '', ''],
    });
  });

  it('keeps supplied action descriptions for a complete sticker set', () => {
    const phrases = Array.from({ length: 40 }, (_, index) => `貼圖 ${index + 1}`);
    const actionDescs = phrases.map((_, index) => `action ${index + 1}`);
    const phraseSet: LineStickerPhraseSetJson = {
      format: PHRASE_SET_FORMAT,
      version: PHRASE_SET_VERSION,
      mode: 'set',
      phrases,
      actionDescs,
    };

    expect(planLineStickerPhraseSetImport(phraseSet)).toEqual({
      mode: 'set',
      phrases,
      actionDescs,
    });
  });
});
