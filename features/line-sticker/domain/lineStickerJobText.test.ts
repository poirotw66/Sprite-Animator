import { describe, expect, it } from 'vitest';
import {
  applyFlatValuesToJobTextState,
  createLineStickerJobTextState,
  flattenJobTextValues,
  jobTextStateFromJobSheets,
} from './lineStickerJobText';
import { createLineStickerJobSheets } from './lineStickerJob';

describe('lineStickerJobTextState', () => {
  it('round-trips flat phrase lists through per-sheet job text', () => {
    const flat = Array.from({ length: 48 }, (_, index) => `p${index}`);
    const next = applyFlatValuesToJobTextState(createLineStickerJobTextState(), 'phrases', flat);
    expect(flattenJobTextValues(next, 'phrases')).toEqual(flat);
    expect(next[0]?.phrases).toHaveLength(16);
    expect(next[2]?.phrases[15]).toBe('p47');
  });

  it('imports phrases from job sheets', () => {
    const sheets = createLineStickerJobSheets(48);
    sheets[1].phrases = Array.from({ length: 16 }, (_, index) => `s1-${index}`);
    const state = jobTextStateFromJobSheets(sheets);
    expect(flattenJobTextValues(state, 'phrases').slice(16, 19)).toEqual(['s1-0', 's1-1', 's1-2']);
  });
});
