/**
 * Sticker on-image caption quality: short, legible, chat-fragment style.
 */

import {
  clampStickerPhrase,
  isEnglishPhraseLanguage,
  LINE_STICKER_PHRASE_MAX_CHARS,
  LINE_STICKER_PHRASE_MAX_ENGLISH_WORDS,
} from './lineStickerPhraseLength';

/** Target max for CJK — 5 chars OK when the line has punch (Nishimura-style wit). */
export const LINE_STICKER_PHRASE_IDEAL_MAX_CHARS = 5;

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const ALLOWED_PUNCT = new Set(['？', '！', '…', '?', '!', '～']);

function stripForbiddenChars(text: string, language: string): string {
  if (isEnglishPhraseLanguage(language)) {
    return text.replace(/["""''（）()[\]【】/\\@#&*<>《》「」『』|]/gu, '');
  }
  return [...text]
    .filter((ch) => /\p{L}|\p{N}/u.test(ch) || ALLOWED_PUNCT.has(ch))
    .join('');
}

/** Corporate / notice-board tone — not the playful sticker voice we want. */
const ZH_WRITTEN_FORM_RE =
  /^(請查收|敬請|茲|本公司|已完成|進行中|敬請見諒|如有疑問)/;

const WHITESPACE_RE = /\s+/g;

export type StickerPhraseIssueCode =
  | 'empty'
  | 'too_long'
  | 'over_ideal_length'
  | 'emoji'
  | 'forbidden_char'
  | 'english_too_wordy'
  | 'written_form'
  | 'whitespace';

export interface StickerPhraseIssue {
  code: StickerPhraseIssueCode;
  message: string;
}

function hasForbiddenChars(text: string, language: string): boolean {
  return stripForbiddenChars(text, language) !== text;
}

function cjkCharCount(phrase: string): number {
  return [...phrase.replace(WHITESPACE_RE, '')].length;
}

function englishWordCount(phrase: string): number {
  return phrase.trim().split(WHITESPACE_RE).filter(Boolean).length;
}

/**
 * Sanitize phrase for programmatic on-sticker overlay.
 */
export function normalizeStickerPhrase(
  phrase: string,
  language: string = 'Traditional Chinese'
): string {
  let text = phrase.trim();
  if (!text) return text;

  text = text.replace(EMOJI_RE, '');
  text = stripForbiddenChars(text, language);
  text = text.replace(WHITESPACE_RE, isEnglishPhraseLanguage(language) ? ' ' : '');
  text = text.trim();

  return clampStickerPhrase(text, language);
}

/**
 * Audit one phrase for on-sticker suitability.
 */
export function getStickerPhraseIssues(
  phrase: string,
  language: string = 'Traditional Chinese'
): StickerPhraseIssue[] {
  const issues: StickerPhraseIssue[] = [];
  const raw = phrase.trim();
  if (!raw) {
    issues.push({ code: 'empty', message: 'empty phrase' });
    return issues;
  }

  if (/\s/.test(raw) && !isEnglishPhraseLanguage(language)) {
    issues.push({ code: 'whitespace', message: 'CJK phrases should not contain spaces' });
  }
  if (EMOJI_RE.test(raw)) {
    issues.push({ code: 'emoji', message: 'emojis are not allowed on sticker captions' });
  }
  if (hasForbiddenChars(raw, language)) {
    issues.push({ code: 'forbidden_char', message: 'contains punctuation unsuitable for sticker overlay' });
  }

  if (isEnglishPhraseLanguage(language)) {
    const words = englishWordCount(raw);
    if (words > LINE_STICKER_PHRASE_MAX_ENGLISH_WORDS) {
      issues.push({ code: 'english_too_wordy', message: `max ${LINE_STICKER_PHRASE_MAX_ENGLISH_WORDS} words for English captions` });
    } else if (words > 2) {
      issues.push({ code: 'over_ideal_length', message: 'prefer 1–2 English words on stickers' });
    }
    return issues;
  }

  const chars = cjkCharCount(raw);
  if (chars > LINE_STICKER_PHRASE_MAX_CHARS) {
    issues.push({ code: 'too_long', message: `max ${LINE_STICKER_PHRASE_MAX_CHARS} characters` });
  } else if (chars > LINE_STICKER_PHRASE_IDEAL_MAX_CHARS) {
    issues.push({ code: 'over_ideal_length', message: `prefer ≤${LINE_STICKER_PHRASE_IDEAL_MAX_CHARS} characters for on-sticker legibility` });
  }

  if (!isEnglishPhraseLanguage(language) && ZH_WRITTEN_FORM_RE.test(raw)) {
    issues.push({ code: 'written_form', message: 'reads like formal text, not a sticker caption' });
  }

  return issues;
}

export function polishStickerPhrases(phrases: string[], language: string): string[] {
  return phrases.map((phrase) => normalizeStickerPhrase(phrase, language));
}

export function auditStickerPhrases(
  phrases: string[],
  language: string = 'Traditional Chinese'
): Array<{ index: number; phrase: string; issues: StickerPhraseIssue[] }> {
  return phrases
    .map((phrase, index) => ({
      index,
      phrase,
      issues: getStickerPhraseIssues(phrase, language),
    }))
    .filter((entry) => entry.issues.length > 0);
}

/** True when phrase is unusable on a sticker (hard reject). */
export function isStickerPhraseRejected(
  phrase: string,
  language: string = 'Traditional Chinese'
): boolean {
  return getStickerPhraseIssues(phrase, language).some((issue) =>
    ['empty', 'too_long', 'emoji', 'forbidden_char', 'english_too_wordy'].includes(issue.code)
  );
}
