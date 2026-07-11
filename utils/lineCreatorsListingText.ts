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

/** Scenes for English shop blurbs (ASCII-safe). */
const THEME_EN_SCENES: Record<string, string> = {
  daily: 'class, group chats, and sleepy mornings',
  social: 'friends, DMs, and group banter',
  workplace: 'meetings, deadlines, and coffee breaks',
  emotion: 'big feelings and little wins',
  meme: 'memes, roasts, and dramatic moments',
  food: 'snacks, cravings, and foodie moods',
};

/** Strip pipeline / draft notes that must not appear in LINE shop copy. */
const SHOP_META_NOTE_RE =
  /[（(][^）)]*(?:版|測試|draft|beta|wip|internal|模型繪字|程式疊字|model|programmatic|debug|工作留|內部)[^）)]*[）)]/giu;

export function stripShopMetaNotes(text: string): string {
  return collapseWhitespace(text.replace(SHOP_META_NOTE_RE, ''));
}

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
  const lower = out.toLowerCase();
  const titleLower = sanitizeEnText(titleEn).toLowerCase();
  if (
    out.length > 0 &&
    !lower.includes('sticker set') &&
    !lower.startsWith(titleLower)
  ) {
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
    return stripShopMetaNotes(input.descZh);
  }

  const hooks = pickPhraseHooks(input.phrases ?? [], 4);
  const themeKey = input.themeKey ?? 'daily';

  if (hooks.length >= 3) {
    const lead = hooks.slice(0, 3).join('、');
    const tail =
      titleZh.includes('校園') || titleZh.includes('學校')
        ? '校園俏皮梗全收錄，群組聊天秒接招！'
        : themeKey === 'workplace'
          ? '職場嘴砲梗一次備齊，回訊息超有戲！'
          : themeKey === 'meme'
            ? '迷因梗圖通通有，聊天秒接招！'
            : '日常俏皮梗全收錄，聊天回你剛剛好！';
    return `${lead}——${tail}`;
  }

  if (hooks.length >= 2) {
    const hookText = hooks.join('、');
    return `${hookText}——句句有戲，聊天剛剛好！`;
  }

  const hookText =
    hooks.length > 0
      ? hooks.join('、')
      : THEME_ZH_HOOKS[themeKey] ?? THEME_ZH_HOOKS.daily!;

  const subject = titleZh.replace(/貼圖(組)?$/u, '').replace(/·/gu, '');
  const shortSubject = subject.length > 10 ? subject.slice(0, 10) : subject;
  return `${shortSubject}陪你${hookText}，句句俏皮有戲！`;
}

export function buildDescEn(input: ShopListingInput, titleEn: string): string {
  if (input.descEn?.trim()) {
    return stripShopMetaNotes(input.descEn);
  }

  const themeKey = input.themeKey ?? 'daily';
  const scene = THEME_EN_SCENES[themeKey] ?? THEME_EN_SCENES.daily!;
  const titleLower = sanitizeEnText(titleEn).toLowerCase();

  if (titleLower.includes('school') || titleLower.includes('campus')) {
    return `Cute school-life comebacks for ${scene} — punchy reactions friends will love.`;
  }
  if (titleLower.includes('couple') || titleLower.includes('lover')) {
    return `Sweet couple comebacks for ${scene} — reactions that feel just right.`;
  }

  const hook = THEME_EN_HOOKS[themeKey] ?? THEME_EN_HOOKS.daily!;
  return `Cute comebacks for ${scene} — playful reactions for ${hook}.`;
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

  const rawTitleZh = stripShopMetaNotes(input.titleZh.trim() || '原創貼圖');
  const titleZh = fitZhTitle(rawTitleZh);
  pushLimitWarning(warnings, 'titleZh', rawTitleZh.replace(/\s+/g, ''), titleZh);

  const rawDescZh = buildDescZh(input, titleZh);
  const descZh = fitZhDescription(rawDescZh);
  pushLimitWarning(warnings, 'descZh', rawDescZh, descZh);

  const rawTitleEn = stripShopMetaNotes(input.titleEn.trim() || 'Original Sticker Set');
  const titleEn = fitEnTitle(rawTitleEn);
  pushLimitWarning(warnings, 'titleEn', sanitizeEnText(rawTitleEn), titleEn);

  const rawDescEn = buildDescEn(input, titleEn);
  const descEn = fitEnDescription(rawDescEn, titleEn);
  pushLimitWarning(warnings, 'descEn', sanitizeEnText(rawDescEn), descEn);

  return { titleZh, descZh, titleEn, descEn, warnings };
}
