/**
 * LINE sticker phrase length limits (short captions for tiny thumbnails).
 */

export const LINE_STICKER_PHRASE_MAX_CHARS = 5;

/** English: max words (not characters). */
export const LINE_STICKER_PHRASE_MAX_ENGLISH_WORDS = 3;

export function isEnglishPhraseLanguage(language: string): boolean {
  return /\benglish\b/i.test(language);
}

/**
 * Clamp a sticker phrase to pack limits. CJK/Japanese: max 5 characters; English: max 3 words.
 */
export function clampStickerPhrase(phrase: string, language: string = 'Traditional Chinese'): string {
  const trimmed = phrase.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (isEnglishPhraseLanguage(language)) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= LINE_STICKER_PHRASE_MAX_ENGLISH_WORDS) {
      return trimmed;
    }
    return words.slice(0, LINE_STICKER_PHRASE_MAX_ENGLISH_WORDS).join(' ');
  }

  const chars = [...trimmed];
  if (chars.length <= LINE_STICKER_PHRASE_MAX_CHARS) {
    return trimmed;
  }
  return chars.slice(0, LINE_STICKER_PHRASE_MAX_CHARS).join('');
}

export function clampStickerPhrases(phrases: string[], language: string): string[] {
  return phrases.map((phrase) => clampStickerPhrase(phrase, language));
}
