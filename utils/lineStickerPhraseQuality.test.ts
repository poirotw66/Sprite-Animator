import { describe, expect, it } from 'vitest';
import {
  auditStickerPhrases,
  getStickerPhraseIssues,
  isLineSendablePhrase,
  isVisualOnlyStickerPhrase,
  normalizeStickerPhrase,
  parseStickerPhraseLine,
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

  it('rejects work-memo phrases that are not tap-to-send chat lines', () => {
    expect(isLineSendablePhrase('謝謝你')).toBe(true);
    expect(isLineSendablePhrase('辛苦了')).toBe(true);
    expect(isLineSendablePhrase('開會中')).toBe(true);
    expect(isLineSendablePhrase('加班中')).toBe(true);
    expect(isLineSendablePhrase('房租進度呢')).toBe(false);
    expect(isLineSendablePhrase('巡邏早安')).toBe(false);
    expect(isLineSendablePhrase('案情不單純')).toBe(false);
    expect(isLineSendablePhrase('巡邏中')).toBe(false);

    const issues = getStickerPhraseIssues('紀錄了', 'Traditional Chinese');
    expect(issues.some((i) => i.code === 'not_sendable')).toBe(true);
  });

  it('allows visual-only empty slots', () => {
    expect(getStickerPhraseIssues('', 'Traditional Chinese')).toEqual([]);
    expect(isVisualOnlyStickerPhrase('')).toBe(true);
    expect(isVisualOnlyStickerPhrase('[無字]')).toBe(true);
    expect(parseStickerPhraseLine('[無字]')).toBe('');
    expect(parseStickerPhraseLine(' 又遲到了 ')).toBe('又遲到了');
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

  it('converts visual-only markers to empty strings', () => {
    expect(polishStickerPhrases(['[無字]', '晚安'], 'Traditional Chinese')).toEqual(['', '晚安']);
  });
});

describe('auditStickerPhrases', () => {
  it('returns only problematic indices', () => {
    const report = auditStickerPhrases(['好', '請查收', ''], 'Traditional Chinese');
    expect(report.map((r) => r.index)).toEqual([1]);
  });
});
