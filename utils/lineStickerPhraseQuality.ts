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

/** Work memo / status report — not a tap-to-send LINE chat line. */
const ZH_NON_SENDABLE_RE =
  /進度|提醒|警報|合約|排程|補件|備份|完畢|表單|單純|膠著|嫌疑|確鑿|頭緒|案情|放大鏡|檢查完|確認完|紀錄了|巡邏|水電費|房租費|請確認|請補|請繳|報告|修繕|滯留|簽好沒|重談|簽到|已閱|試味中|學妹來|將軍巡|合約簽|合約重|進件|回報|查核|稽核|送審|立案|辦案|推理中|證據鏈|水電表|房租進|確認中|通知|紀錄進|已排程|先備份|表單呢|水電費|修繕|案情不|沒頭緒|嫌疑嗎|證據確/;
const ZH_STATUS_REPORT_RE = /(巡邏|辦案|確認完|試味|備份|排程|查房|繳租|辦理|紀錄)中$/;

const WHITESPACE_RE = /\s+/g;

export type StickerPhraseIssueCode =
  | 'too_long'
  | 'over_ideal_length'
  | 'emoji'
  | 'forbidden_char'
  | 'english_too_wordy'
  | 'written_form'
  | 'not_sendable'
  | 'whitespace';

/** True when the sticker cell has no on-image caption (expression-only). */
export function isVisualOnlyStickerPhrase(phrase: string): boolean {
  const raw = phrase.trim();
  if (!raw) return true;
  return /^(無字|无字|\(visual[- ]?only\)|\[visual[- ]?only\]|visual[- ]?only|\[無字\])$/i.test(raw);
}

/** Normalize one model output line to a phrase slot (`""` = visual-only). */
export function parseStickerPhraseLine(line: string): string {
  return isVisualOnlyStickerPhrase(line) ? '' : line.trim();
}

export const STICKER_PHRASE_HARD_REJECT_CODES: StickerPhraseIssueCode[] = [
  'too_long',
  'emoji',
  'forbidden_char',
  'english_too_wordy',
  'not_sendable',
];

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
  if (isVisualOnlyStickerPhrase(raw)) {
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

  if (!isEnglishPhraseLanguage(language) && !isLineSendablePhrase(raw)) {
    issues.push({
      code: 'not_sendable',
      message: 'reads like a work memo or scene caption, not a LINE chat line you would tap to send',
    });
  }

  return issues;
}

/** True when the phrase is short enough to send in a LINE chat (not a status report). */
export function isLineSendablePhrase(phrase: string): boolean {
  const raw = phrase.trim();
  if (!raw || isVisualOnlyStickerPhrase(raw)) {
    return true;
  }
  if (ZH_WRITTEN_FORM_RE.test(raw)) {
    return false;
  }
  if (ZH_NON_SENDABLE_RE.test(raw)) {
    return false;
  }
  if (ZH_STATUS_REPORT_RE.test(raw)) {
    return false;
  }
  return true;
}

export function polishStickerPhrases(phrases: string[], language: string): string[] {
  return phrases.map((phrase) =>
    isVisualOnlyStickerPhrase(phrase) ? '' : normalizeStickerPhrase(phrase, language)
  );
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

export function isHardRejectStickerPhraseIssue(code: StickerPhraseIssueCode): boolean {
  return STICKER_PHRASE_HARD_REJECT_CODES.includes(code);
}

/** True when phrase is unusable on a sticker (hard reject). */
export function isStickerPhraseRejected(
  phrase: string,
  language: string = 'Traditional Chinese'
): boolean {
  return getStickerPhraseIssues(phrase, language).some((issue) =>
    isHardRejectStickerPhraseIssue(issue.code)
  );
}
