/**
 * LINE Creators Market shop listing text (titles + descriptions).
 * Limits match line_playwright_common.py / official form constraints.
 */

export const LINE_CREATORS_LIMITS = {
  zhTitle: 20,
  zhDesc: 80,
  enTitle: 39,
  enDesc: 160,
} as const;

const THEME_ZH_HOOKS: Record<string, string> = {
  daily: '聊日常、撒嬌、晚安',
  social: '回好友、按讚、玩梗',
  workplace: '上班、開會、下班',
  emotion: '開心、崩潰、療癒',
  meme: '迷因、吐槽、大笑',
  food: '吃貨、下午茶、療癒',
};

const THEME_EN_HOOKS: Record<string, string> = {
  daily: 'daily chats, greetings, and cozy moods',
  social: 'friends, reactions, and fun replies',
  workplace: 'office life, meetings, and breaks',
  emotion: 'happy, stressed, and heartfelt moments',
  meme: 'memes, jokes, and dramatic reactions',
  food: 'snacks, meals, and foodie moods',
};

export interface ShopListingInput {
  titleZh: string;
  descZh?: string;
  titleEn: string;
  descEn?: string;
  phrases?: string[];
  themeKey?: string;
}

export interface ShopListingResult {
  titleZh: string;
  descZh: string;
  titleEn: string;
  descEn: string;
  warnings: string[];
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function fitZhTitle(title: string, maxLen: number = LINE_CREATORS_LIMITS.zhTitle): string {
  const collapsed = collapseWhitespace(title).replace(/\s+/g, '');
  if (collapsed.length <= maxLen) {
    return collapsed;
  }

  const parts = collapsed.split('·').filter(Boolean);
  if (parts.length > 1) {
    for (let keep = parts.length - 1; keep >= 1; keep -= 1) {
      const candidate = parts.slice(0, keep).join('·');
      if (candidate.length <= maxLen) {
        return candidate;
      }
    }
    const head = parts[0]!;
    if (head.length <= maxLen) {
      return head;
    }
  }

  return collapsed.slice(0, maxLen);
}

export function fitZhDescription(
  desc: string,
  maxLen: number = LINE_CREATORS_LIMITS.zhDesc
): string {
  const collapsed = collapseWhitespace(desc);
  if (collapsed.length <= maxLen) {
    return collapsed;
  }
  return collapsed.slice(0, maxLen);
}

export function sanitizeEnText(value: string): string {
  const replacements: Record<string, string> = {
    '\u2014': '-',
    '\u2013': '-',
    '\u2212': '-',
    '\u2026': '...',
    '\u00a0': ' ',
    '\u00a9': '(c)',
    '\u2018': "'",
    '\u2019': "'",
    '\u201c': '"',
    '\u201d': '"',
  };
  let out = value;
  for (const [from, to] of Object.entries(replacements)) {
    out = out.split(from).join(to);
  }
  return collapseWhitespace(out.replace(/[^\u0020-\u007E]/g, ''));
}

export function fitEnTitle(title: string, maxLen: number = LINE_CREATORS_LIMITS.enTitle): string {
  let out = sanitizeEnText(title);
  if (out.length <= maxLen) {
    return out;
  }
  out = out.replace(/: My /g, ': ').replace(/ with a Hound$/i, '');
  if (out.length <= maxLen) {
    return out;
  }
  const truncated = out.slice(0, maxLen + 1).replace(/\s+\S*$/, '');
  return truncated.replace(/[:\- ]+$/, '');
}

export function fitEnDescription(
  desc: string,
  titleEn: string,
  maxLen: number = LINE_CREATORS_LIMITS.enDesc
): string {
  let out = sanitizeEnText(desc);
  const prefix = `${titleEn} Sticker set. `;
  if (!out.includes('Sticker set.')) {
    out = prefix + out;
  }
  if (out.length <= maxLen) {
    return out;
  }
  return out.slice(0, maxLen).trim();
}

function pickPhraseHooks(phrases: string[], maxCount: number = 3): string[] {
  return phrases
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0 && phrase.length <= 8)
    .slice(0, maxCount);
}

export function buildDescZh(input: ShopListingInput, titleZh: string): string {
  if (input.descZh?.trim()) {
    return input.descZh.trim();
  }

  const hooks = pickPhraseHooks(input.phrases ?? []);
  const hookText =
    hooks.length > 0
      ? hooks.join('、')
      : THEME_ZH_HOOKS[input.themeKey ?? 'daily'] ?? THEME_ZH_HOOKS.daily!;

  const subject = titleZh.replace(/貼圖(組)?$/u, '').replace(/·/gu, '');
  const shortSubject = subject.length > 10 ? subject.slice(0, 10) : subject;
  return `${shortSubject}陪你${hookText}！每句都有可愛反應。`;
}

export function buildDescEn(input: ShopListingInput, titleEn: string): string {
  if (input.descEn?.trim()) {
    return input.descEn.trim();
  }

  const samples = pickPhraseHooks(input.phrases ?? [], 3)
    .map((phrase) => sanitizeEnText(phrase))
    .filter(Boolean);
  if (samples.length > 0) {
    return `Perfect for ${samples.join(', ')} and more.`;
  }

  const hook =
    THEME_EN_HOOKS[input.themeKey ?? 'daily'] ?? THEME_EN_HOOKS.daily!;
  return `Cute reactions for ${hook}.`;
}

function pushLimitWarning(
  warnings: string[],
  field: string,
  raw: string,
  fitted: string
): void {
  if (raw !== fitted) {
    warnings.push(`${field} trimmed (${raw.length} -> ${fitted.length}): ${fitted}`);
  }
}

/** Fit and polish shop listing copy for LINE Creators Market upload. */
export function prepareShopListing(input: ShopListingInput): ShopListingResult {
  const warnings: string[] = [];

  const rawTitleZh = input.titleZh.trim() || '原創貼圖';
  const titleZh = fitZhTitle(rawTitleZh);
  pushLimitWarning(warnings, 'titleZh', rawTitleZh.replace(/\s+/g, ''), titleZh);

  const rawDescZh = buildDescZh(input, titleZh);
  const descZh = fitZhDescription(rawDescZh);
  pushLimitWarning(warnings, 'descZh', rawDescZh, descZh);

  const rawTitleEn = input.titleEn.trim() || 'Original Sticker Set';
  const titleEn = fitEnTitle(rawTitleEn);
  pushLimitWarning(warnings, 'titleEn', sanitizeEnText(rawTitleEn), titleEn);

  const rawDescEn = buildDescEn(input, titleEn);
  const descEn = fitEnDescription(rawDescEn, titleEn);
  pushLimitWarning(warnings, 'descEn', sanitizeEnText(rawDescEn), descEn);

  return { titleZh, descZh, titleEn, descEn, warnings };
}
