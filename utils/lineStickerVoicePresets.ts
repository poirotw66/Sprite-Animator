/**
 * On-sticker caption voice presets (tone / personality for phrase generation).
 * Add new entries here; select with --voice in design-phrase-set.mts.
 * Chinese aliases (企鵝、咖波、戲謔…) live in lineStickerSetNaming.ts.
 */

export interface StickerVoicePreset {
  label: string;
  /** One-line persona for the top of the Gemini prompt. */
  intro: string;
  /** Voice rules injected into the prompt (markdown). */
  rules: string;
  /** Example good lines (vibe only — model must invent new ones). */
  goodExamples: string[];
  /** Lines to avoid. */
  badExamples: string[];
  /** Optional length guidance override (defaults to standard 3–5 zh). */
  lengthHint?: string;
}

export const DEFAULT_STICKER_VOICE_KEY = 'nishimura';

export const STICKER_VOICE_PRESETS: Record<string, StickerVoicePreset> = {
  nishimura: {
    label: '西村戲謔（預設）',
    intro:
      'Playful Taiwan/Japan character packs like NishimuraYuji: teasing, relatable, smirk-worthy (戲謔、會心一笑、感同身受).',
    rules: `- **戲謔但不惡毒**：吐槽熟人、自嘲、誇張抱怨、裝傻、假正經——讓人會心一笑。
- **感同身受**：拖延、已讀不回、嘴硬、吃醋、耍廢、突然心軟——具體處境。
- **有角色感**：欸、又、才、別、蛤、喔、唷、啦、煩、哼——像角色在講話。`,
    goodExamples: ['又遲到', '才不要', '你贏了', '我廢了', '別鬧了', '煩欸', '笑死', '太扯', '算你狠'],
    badExamples: ['請稍候', '已完成', '沒問題的', '我知道了', '加油加油'],
  },
  minimal: {
    label: '極簡反應',
    intro: 'Ultra-short LINE reaction captions — one tap equals one word or interjection.',
    rules: `- **極短、極常用**：單字或雙字反應，像聊天窗快捷回覆。
- **中性友善**：不戲謔、不講梗，重在清楚表達情緒或態度。
- **適合小字**：2–3 字優先，4 字僅在必要時。`,
    goodExamples: ['好', '謝', '嗯', '喔', '累', '忙', '懂', '假', '讚', '拜'],
    badExamples: ['又遲到了', '請稍候', '感謝來信', '我知道了'],
    lengthHint:
      '**Chinese**: max 5 characters; **target 2–3**; prefer single interjections when possible.',
  },
  meme: {
    label: '迷因梗圖',
    intro: 'Taiwan internet meme / 梗圖 energy — absurd, iconic, slightly unhinged but still sendable in chat.',
    rules: `- **有梗、有記憶點**：誇張、反邏輯、突然轉折，像迷因截圖上的字。
- **可略浮誇**：荒謬但台灣網路語境讀得懂。
- **不要解釋梗**：一行就是一個梗，不需前後文。`,
    goodExamples: ['真香', '我就爛', '母湯喔', '哭啊', '是在哈', '太狠了', '計畫通', '不合理'],
    badExamples: ['請查收', '感謝支持', '祝您愉快', '沒問題的'],
  },
  sweet: {
    label: '撒嬌軟萌',
    intro: 'Cute clingy affection — sweet, pouty, needy in a charming way (撒嬌、軟萌、討抱抱).',
    rules: `- **撒嬌不噁心**：可愛抱怨、討抱抱、吃醋、求關注——讓人想回。
- **語氣軟**：啦、嘛、哼、嗚、嘛、欸——帶點委屈或害羞。
- **避免攻擊性**：不嗆人、不冷笑話。`,
    goodExamples: ['想你了', '抱抱', '哼', '嘛', '委屈', '陪陪我', '不要嘛', '好想你'],
    badExamples: ['請稍候', '你贏了', '我就爛', '太扯了'],
  },
  workplace: {
    label: '職場冷幽默',
    intro: 'Office / workplace deadpan — polite on the surface, exhausted or sarcastic underneath.',
    rules: `- **表面正經、底裡崩潰**：收到、了解、但語氣透露社畜感。
- **職場情境**：開會、加班、已讀、deadline、老闆、報告——具體可畫表情。
- **不違反禮貌到不能送**：仍可日常傳，帶無奈或冷幽默。`,
    goodExamples: ['收到', '了解', '再說', '先這樣', '加班中', '開會中', '已讀', '明天見'],
    badExamples: ['去死', '辭了', '老闆滾', '請查收附件'],
  },
  dramatic: {
    label: '情緒爆發',
    intro: 'Big exaggerated emotions — meltdown, rage, hype, despair (誇張、戲劇化、表情超大).',
    rules: `- **情緒外放**：暴怒、崩潰、狂喜、震驚——適合大動作表情。
- **誇張但可愛**：戲劇化，不是真的攻擊。
- **強烈動詞感**：讓插畫師畫大表情。`,
    goodExamples: ['崩潰', '暴怒', '狂笑', '大哭', '震驚', '翻白眼', '心碎', '超開心'],
    badExamples: ['請稍候', '已完成', '感謝您', '沒問題'],
  },
  penguin: {
    label: '企鵝家族心情日常',
    intro:
      'Like LINE pack「企鵝家族心情日常」: wholesome penguin family mood diary — soft, cute, everyday feelings (可愛、療癒、心情小記).',
    rules: `- **心情標籤感**：一行就是一個今日心情——開心、累累、放空、淡定、委屈但不兇。
- **療癒可愛**：適合全家、朋友日常問候與打氣，不嗆、不陰陽。
- **情緒清楚**：讓人一看懂表情該怎麼畫——害羞、期待、鬆一口氣、小得意。
- **溫暖口語**：謝謝、加油、晚安——可 2–4 字，帶點軟萌。`,
    goodExamples: ['開心', '好累', '加油', '謝謝', '晚安', '摸摸', '淡定', '放空', '好棒', '嗚嗚'],
    badExamples: ['我就爛', '太扯了', '你贏了', '請查收', '去死'],
  },
  capoo: {
    label: '咖波',
    intro:
      'Like Taiwan mascot Capoo (咖波): lazy adorable monster — food, sleep, mild chaos, wholesome absurdity (廢廢可愛、突然認真).',
    rules: `- **廢萌日常**：餓了、睏了、不想動、好爽、怕爆——具體身體感與小崩潰。
- **天然呆**：突然蛤？、哇、嗯？——可愛裝傻，不是刻薄吐槽。
- **吃貨/躺平感**：能聯想到食物、睡覺、耍廢的處境。
- **台灣聊天感**：親切好笑，讓人想傳給好友一起笑。`,
    goodExamples: ['好餓', '躺平', '不想動', '好爽', '睡惹', '怕爆', '哇', '蛤', '麻煩', '可愛'],
    badExamples: ['請稍候', '已完成', '感謝來信', '敬請見諒'],
  },
  kana: {
    label: '卡娜',
    intro:
      'Like Kana (卡娜) LINE sticker tone: bubbly cute girl energy — playful pout, shy pride, earnest cheer (活潑、小任性、真心打氣).',
    rules: `- **活潑少女感**：嘿嘿、哼、好嘛、討厭啦——帶點嬌嗔但不惡。
- **情緒透明**：開心、委屈、害羞、加油——表情好畫、態度清楚。
- **親密對話感**：像跟熟朋友撒嬌或吐槽，不是公告或客服。
- **可甜可鬧**：同一套裡要有撒嬌、鼓勵、小生氣、和好。`,
    goodExamples: ['嘿嘿', '好嘛', '討厭', '加油', '抱抱', '委屈', '真的', '哼', '開心', '不老實'],
    badExamples: ['請查收', '已完成', '沒問題的', '我就爛'],
  },
};

export function listStickerVoiceKeys(): string[] {
  return Object.keys(STICKER_VOICE_PRESETS);
}

export function resolveStickerVoice(
  voiceKey?: string,
  customVoiceContext?: string
): StickerVoicePreset & { key: string } {
  if (customVoiceContext?.trim()) {
    return {
      key: 'custom',
      label: '自訂',
      intro: customVoiceContext.trim(),
      rules: customVoiceContext.trim(),
      goodExamples: [],
      badExamples: ['請稍候', '已完成', '公告語氣'],
    };
  }
  const key = voiceKey?.trim() || DEFAULT_STICKER_VOICE_KEY;
  const preset = STICKER_VOICE_PRESETS[key];
  if (!preset) {
    throw new Error(
      `Unknown voice "${key}". Choose: ${listStickerVoiceKeys().join(', ')}, or pass --voice-context "..."`
    );
  }
  return { key, ...preset };
}

export function buildStickerVoicePromptBlock(voice: StickerVoicePreset): string {
  const good =
    voice.goodExamples.length > 0
      ? `\n**Good vibe (invent NEW lines):** ${voice.goodExamples.join('、')}`
      : '';
  const bad =
    voice.badExamples.length > 0
      ? `\n**Bad (avoid):** ${voice.badExamples.join('、')}`
      : '';
  return `### [Voice — ${voice.label}]
${voice.rules}${good}${bad}`;
}

export const DEFAULT_STICKER_LENGTH_HINT = `**Chinese (Traditional/Simplified)**: **max 5 characters**; **sweet spot 3–5** when the joke needs it; **2–3** for pure interjections.
- **Japanese**: max 5 mora-equivalent; casual spoken fragments.
- **English**: max 3 words; target 1–2; punchy interjections OK.
- Shorten only if illegible—do not sacrifice personality if 4–5 still reads clean on a sticker.`;
