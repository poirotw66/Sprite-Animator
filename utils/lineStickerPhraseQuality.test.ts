import { describe, expect, it } from 'vitest';
import {
  auditStickerPhrases,
  getStickerPhraseIssues,
  normalizeStickerPhrase,
  polishStickerPhrases,
} from './lineStickerPhraseQuality';

describe('normalizeStickerPhrase', () => {
  it('strips emojis and forbidden punctuation', () => {
    expect(normalizeStickerPhrase('早安😊', 'Traditional Chinese')).toBe('早安');
    expect(normalizeStickerPhrase('（加油）', 'Traditional Chinese')).toBe('加油');
    expect(normalizeStickerPhrase('OK!', 'English')).toBe('OK!');
  });

  it('clamps length after sanitizing', () => {
    expect(normalizeStickerPhrase('小朋友才做選擇', 'Traditional Chinese')).toBe('小朋友才做');
  });
});

describe('getStickerPhraseIssues', () => {
  it('accepts short chat fragments', () => {
    expect(getStickerPhraseIssues('早安', 'Traditional Chinese')).toEqual([]);
    expect(getStickerPhraseIssues('OK', 'English')).toEqual([]);
  });

  it('flags corporate written forms', () => {
    const issues = getStickerPhraseIssues('請查收', 'Traditional Chinese');
    expect(issues.some((i) => i.code === 'written_form')).toBe(true);
  });

  it('allows witty 5-char punchlines', () => {
    expect(getStickerPhraseIssues('又遲到了', 'Traditional Chinese')).toEqual([]);
  });

  it('rejects overly long English', () => {
    const issues = getStickerPhraseIssues('see you later alligator', 'English');
    expect(issues.some((i) => i.code === 'english_too_wordy')).toBe(true);
  });
});

describe('polishStickerPhrases', () => {
  it('normalizes every entry', () => {
    expect(polishStickerPhrases([' 早安😊 ', '（加油）'], 'Traditional Chinese')).toEqual([
      '早安',
      '加油',
    ]);
  });
});

describe('auditStickerPhrases', () => {
  it('returns only problematic indices', () => {
    const report = auditStickerPhrases(['好', '請查收', ''], 'Traditional Chinese');
    expect(report.map((r) => r.index)).toEqual([1, 2]);
  });
});
