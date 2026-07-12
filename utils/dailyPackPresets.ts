/**
 * Rotation pools for daily-pack.mts — separate from web UI dropdowns.
 */

/** Theme keys used by the daily factory (subset + new themes in THEME_PRESETS). */
export const DAILY_PACK_THEME_KEYS = [
  'daily',
  'workplace',
  'meme',
  'food',
  'couple',
  'catSlaves',
] as const;

export type DailyPackThemeKey = (typeof DAILY_PACK_THEME_KEYS)[number];

/** Voice keys for daily factory rotation. */
export const DAILY_PACK_VOICE_KEYS = [
  'nishimura',
  'penguin',
  'capoo',
  'workplace',
  'tsundere',
  'positive',
  'lieFlat',
  'nihilistic',
  'troll',
] as const;

export type DailyPackVoiceKey = (typeof DAILY_PACK_VOICE_KEYS)[number];

/**
 * Daily rotation style keys — some map to STYLE_PRESETS keys via resolveDailyPackStyleKey.
 */
export const DAILY_PACK_STYLE_KEYS = [
  'yurukawa',
  'chibi',
  'pixel',
  'crayon',
  'line-art',
  'watercolor',
  'lineChibi',
  'pastel',
  'doodle',
  'minimalist',
] as const;

export type DailyPackStyleKey = (typeof DAILY_PACK_STYLE_KEYS)[number];

/** Map daily-pack style labels to generate-character-ref --style keys. */
export const DAILY_PACK_STYLE_TO_PRESET: Record<DailyPackStyleKey, string> = {
  yurukawa: 'yurukawa',
  chibi: 'chibi',
  pixel: 'pixel',
  crayon: 'pastel',
  'line-art': 'minimalist',
  watercolor: 'watercolor',
  lineChibi: 'lineChibi',
  pastel: 'pastel',
  doodle: 'doodle',
  minimalist: 'minimalist',
};

export function resolveDailyPackStyleKey(styleKey: DailyPackStyleKey): string {
  return DAILY_PACK_STYLE_TO_PRESET[styleKey] ?? styleKey;
}

export const DEFAULT_DAILY_PACK_RATIO = '2:1';

export function parseDailyPackRatio(ratio: string): { bCount: number; aCount: number } {
  const match = ratio.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  if (!match) {
    throw new Error(`Invalid --ratio "${ratio}" (expected e.g. 2:1)`);
  }
  const bWeight = Number.parseInt(match[1]!, 10);
  const aWeight = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(bWeight) || !Number.isFinite(aWeight) || bWeight < 1 || aWeight < 1) {
    throw new Error(`Invalid --ratio "${ratio}"`);
  }
  return { bCount: bWeight, aCount: aWeight };
}

export function splitBatchCounts(
  total: number,
  ratio: string = DEFAULT_DAILY_PACK_RATIO
): { bSlots: number; aSlots: number } {
  const { bCount, aCount } = parseDailyPackRatio(ratio);
  const sum = bCount + aCount;
  const bSlots = Math.round((total * bCount) / sum);
  const aSlots = total - bSlots;
  return { bSlots, aSlots };
}
