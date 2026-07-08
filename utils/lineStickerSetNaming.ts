/**
 * Traditional Chinese naming helpers for LINE sticker sets (phrase-set name, shop title).
 */

import { fitZhTitle, prepareShopListing } from './lineCreatorsListingText.ts';
import { THEME_PRESETS } from './lineStickerPresets.ts';
import {
  listStickerVoiceKeys,
  STICKER_VOICE_PRESETS,
  type StickerVoicePreset,
} from './lineStickerVoicePresets.ts';

const CJK_RE = /[\u3400-\u9fff]/;

/** Voice preset → short Traditional Chinese label for set titles (no parentheticals). */
export const VOICE_SHORT_LABELS: Record<string, string> = {
  nishimura: '戲謔風',
  minimal: '極簡風',
  meme: '迷因風',
  sweet: '撒嬌風',
  workplace: '職場風',
  dramatic: '爆發風',
  penguin: '企鵝療癒風',
  capoo: '咖波風',
  kana: '卡娜風',
};

export const VOICE_PRIMARY_ZH_ALIAS: Record<string, string> = {
  nishimura: '戲謔',
  minimal: '極簡',
  meme: '迷因',
  sweet: '撒嬌',
  workplace: '職場幽默',
  dramatic: '爆發',
  penguin: '企鵝',
  capoo: '咖波',
  kana: '卡娜',
};

/** Accept Chinese aliases on the CLI instead of English keys like `penguin`. */
export const VOICE_ZH_ALIASES: Record<string, string> = {
  戲謔: 'nishimura',
  西村: 'nishimura',
  西村戲謔: 'nishimura',
  極簡: 'minimal',
  極簡反應: 'minimal',
  迷因: 'meme',
  梗圖: 'meme',
  迷因梗圖: 'meme',
  撒嬌: 'sweet',
  軟萌: 'sweet',
  撒嬌軟萌: 'sweet',
  職場幽默: 'workplace',
  社畜: 'workplace',
  職場冷幽默: 'workplace',
  爆發: 'dramatic',
  戲劇: 'dramatic',
  情緒爆發: 'dramatic',
  企鵝: 'penguin',
  企鵝家族: 'penguin',
  企鵝家族心情日常: 'penguin',
  咖波: 'capoo',
  卡娜: 'kana',
};

export const THEME_ZH_ALIASES: Record<string, string> = {
  日常: 'daily',
  日常聊天: 'daily',
  社群: 'social',
  社群互動: 'social',
  職場: 'workplace',
  職場對話: 'workplace',
  情緒: 'emotion',
  情緒表現: 'emotion',
  迷因主題: 'meme',
  美食: 'food',
  美食饕客: 'food',
};

const THEME_EN_LABELS: Record<string, string> = {
  daily: 'Daily Chat',
  social: 'Social',
  workplace: 'Workplace',
  emotion: 'Emotion',
  meme: 'Meme',
  food: 'Food',
};

const VOICE_EN_LABELS: Record<string, string> = {
  nishimura: 'Playful',
  minimal: 'Minimal',
  meme: 'Meme',
  sweet: 'Sweet',
  workplace: 'Office',
  dramatic: 'Dramatic',
  penguin: 'Penguin Mood',
  capoo: 'Capoo',
  kana: 'Kana',
};

export function containsCjk(text: string): boolean {
  return CJK_RE.test(text);
}

export function stripLabelParenthetical(label: string): string {
  return label.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
}

export function resolveVoiceKey(input?: string): string | undefined {
  const raw = input?.trim();
  if (!raw) return undefined;
  if (raw in STICKER_VOICE_PRESETS) return raw;
  const alias = VOICE_ZH_ALIASES[raw];
  if (alias) return alias;
  throw new Error(
    `Unknown voice "${raw}". Choose: ${formatVoiceChoicesForError()}`
  );
}

export function resolveThemeKey(input?: string): string | undefined {
  const raw = input?.trim();
  if (!raw) return undefined;
  if (raw in THEME_PRESETS) return raw;
  const alias = THEME_ZH_ALIASES[raw];
  if (alias) return alias;
  throw new Error(
    `Unknown theme "${raw}". Choose: ${Object.keys(THEME_PRESETS).join(', ')}, or a Chinese alias like 日常、企鵝風格請用 --voice`
  );
}

export function voiceShortLabel(voiceKey: string, voice?: StickerVoicePreset): string {
  const short = VOICE_SHORT_LABELS[voiceKey];
  if (short) return short;
  if (voice?.label) return stripLabelParenthetical(voice.label);
  return voiceKey;
}

export function themeLabel(themeKey?: string, themeContext?: string): string {
  if (themeContext?.trim()) {
    const trimmed = themeContext.trim();
    return trimmed.length > 12 ? `${trimmed.slice(0, 12)}…` : trimmed;
  }
  if (themeKey && themeKey in THEME_PRESETS) {
    return THEME_PRESETS[themeKey as keyof typeof THEME_PRESETS].label;
  }
  return '日常聊天';
}

/**
 * Suggested phrase-set `name` / shop `titleZh`, e.g. "奶油獺·日常聊天·戲謔風".
 */
export function suggestPhraseSetNameZh(params: {
  themeKey?: string;
  themeContext?: string;
  voiceKey: string;
  voice?: StickerVoicePreset;
  characterName?: string;
}): string {
  const theme = themeLabel(params.themeKey, params.themeContext);
  const voice = voiceShortLabel(params.voiceKey, params.voice);
  const character = params.characterName?.trim();

  let raw: string;
  if (character) {
    raw = `${character}·${theme}`;
  } else if (theme.includes(voice) || voice.includes(theme)) {
    raw = theme;
  } else {
    raw = `${theme}·${voice}`;
  }
  return fitZhTitle(raw);
}

/** English filesystem slug for ZIP / upload folder when title is Chinese. */
export function suggestSetNameEn(params: {
  titleZh: string;
  themeKey?: string;
  voiceKey: string;
  characterName?: string;
}): string {
  if (!containsCjk(params.titleZh)) {
    return params.titleZh.trim();
  }
  const character = params.characterName?.trim();
  const themeEn = params.themeKey ? THEME_EN_LABELS[params.themeKey] : 'Sticker';
  const voiceEn = VOICE_EN_LABELS[params.voiceKey] ?? 'Set';
  if (character && !containsCjk(character)) {
    return `${character} ${themeEn}`;
  }
  return `${themeEn} ${voiceEn} Set`;
}

export function suggestDescZh(titleZh: string, phrases?: string[]): string {
  return prepareShopListing({
    titleZh,
    titleEn: 'Sticker Set',
    phrases,
  }).descZh;
}

export function defaultTitleZhFromPhraseSet(name: string | undefined, phrases: string[]): string {
  const trimmed = name?.trim();
  if (trimmed && containsCjk(trimmed)) {
    return fitZhTitle(trimmed);
  }
  const first = phrases.find((phrase) => phrase.trim().length > 0)?.trim();
  if (first && containsCjk(first)) {
    return fitZhTitle(`${first}貼圖`);
  }
  if (trimmed) {
    return trimmed;
  }
  return '原創貼圖';
}

export function formatVoiceChoicesForError(): string {
  return listStickerVoiceKeys()
    .map((key) => {
      const preset = STICKER_VOICE_PRESETS[key];
      const short = VOICE_SHORT_LABELS[key] ?? preset.label;
      return `${short} (${key})`;
    })
    .join(', ');
}

export function listVoiceChoicesZh(): Array<{ key: string; zhName: string; zhAlias: string; label: string }> {
  return listStickerVoiceKeys().map((key) => {
    const preset = STICKER_VOICE_PRESETS[key];
    const zhName = VOICE_SHORT_LABELS[key] ?? stripLabelParenthetical(preset.label);
    const zhAlias = VOICE_PRIMARY_ZH_ALIAS[key] ?? zhName.replace(/風$/, '');
    return { key, zhName, zhAlias, label: preset.label };
  });
}
