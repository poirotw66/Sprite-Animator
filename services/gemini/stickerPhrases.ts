/**
 * LINE sticker phrase generation via Gemini text model.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';
import { PHRASE_GENERATION_MODEL } from '../../utils/constants';
import { clampStickerPhrases } from '../../utils/lineStickerPhraseLength';
import {
  parseStickerPhraseLine,
  polishStickerPhrases,
} from '../../utils/lineStickerPhraseQuality';
import {
  buildStickerVoicePromptBlock,
  DEFAULT_STICKER_LENGTH_HINT,
  DEFAULT_STICKER_VOICE_KEY,
  resolveStickerVoice,
} from '../../utils/lineStickerVoicePresets';
import { API_KEY_MISSING_MESSAGE } from './types';

export async function generateStickerPhrases(
  apiKey: string,
  themeContext: string,
  language: string,
  totalFrames: number,
  model: string = PHRASE_GENERATION_MODEL,
  examplePhrases: string[] = [],
  voiceKey: string = DEFAULT_STICKER_VOICE_KEY,
  customVoiceContext?: string
): Promise<string[]> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const ai = new GoogleGenAI({ apiKey });

  const contentCount = Math.max(1, totalFrames);
  const visualOnlyTarget = Math.max(1, Math.round(contentCount * 0.3));
  const captionedTarget = contentCount - visualOnlyTarget;

  const exampleBlock =
    examplePhrases.length > 0
      ? `\n### [Reference Example Phrases] (same theme, same language tone)\nUse only as vibe reference; invent **new** phrases in the same spirit. Do not copy or lightly tweak.\n${examplePhrases.slice(0, 16).map((p) => `- ${p}`).join('\n')}\n`
      : '';

  const voice = resolveStickerVoice(voiceKey, customVoiceContext);
  const voiceBlock = buildStickerVoicePromptBlock(voice);
  const lengthHint = voice.lengthHint ?? DEFAULT_STICKER_LENGTH_HINT;

  const prompt = `You are an expert LINE sticker copywriter. ${voice.intro}

### [Objective]
- Produce exactly **${contentCount}** sticker slots for one coherent pack matching the Theme below.
- **~${captionedTarget} slots** get a short caption printed ON the sticker (bold, legible at thumbnail size).
- **~${visualOnlyTarget} slots** are **visual-only** — strong pose/expression, **no on-image text**. Mark these with exactly \`[無字]\`.
- Every **non-empty** caption must be something a user would **tap and send in LINE chat** instead of typing — witty, relatable, voice-matched.
- **Character voice first** — match the Voice section; NOT neutral utility text unless Voice says so.
- Spread **distinct moods** across the pack.

### [Theme]
${themeContext}${exampleBlock}

### [Language]
Output **${language}** only.

${voiceBlock}

### [Length — captions that fit ON the sticker]
${lengthHint}

### [Caption quality — when text is present]
- Thumbnail-first: avoid dense punctuation, quotes, parentheses, slashes, hashtags, URLs.
- **Pairable with art**: illustrator draws pose/expression from the line—concrete reactions beat abstract metaphors.
- Natural spoken rhythm; Taiwanese/Japanese LINE chat flavor for zh/ja when applicable.
- No duplicate or near-synonym meanings across captioned lines.
- Each caption works alone without context from other stickers.

### [Visual-only slots]
- Use \`[無字]\` for expression/gesture-only stickers (laughing face, shocked face, thumbs up, etc.).
- Do NOT use \`[無字]\` for every slot — mix captioned and visual-only for a balanced pack.
- Visual-only slots still need a drawable reaction; captions are omitted on purpose.

### [Theme alignment]
- No category headers in output.
- Stay inside the Theme; no generic filler.

### [Output format — STRICT]
Exactly **${contentCount}** lines, flat list only.
- Captioned line: "- " then the phrase only (no quotes).
- Visual-only line: "- [無字]"
- No headings, numbering, blank lines, preamble, or sign-off.

### [Forbidden]
- Emojis, explanations, meta commentary
- Labels ("Sticker 1/48"), numbering prefixes on phrases
- Multi-clause sentences, semicolon chains
- Empty lines or placeholder text other than \`[無字]\`

Generate the ${contentCount} lines now.`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      temperature: 0.9,
      maxOutputTokens: 16384,
    },
  });

  let text = response.text ?? '';
  try {
    const candidates = (response as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }).candidates;
    const partText = candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof partText === 'string' && partText.length > text.length) {
      text = partText;
    }
  } catch (_) {}

  logger.log(
    '[gemini-3-flash] Sticker phrases raw response | text length =',
    text.length
  );
  logger.log('[gemini-3-flash] Full text used for parsing:', text);
  try {
    const res = response as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    if (res.candidates?.[0]) {
      logger.log(
        '[gemini-3-flash] finishReason (MAX_TOKENS = truncated) =',
        res.candidates[0].finishReason
      );
    }
  } catch (_) {}

  const sectionHeaders =
    /^(萬用日常|情緒爆發|關係互動|梗圖型|Universal Daily|Emotional Outburst|Social Interaction|Meme\/Iconic)\s*[：:]\s*$/i;
  const bulletMatch = /^\s*[-*]\s*(.+)$/;
  const lines = text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      if (/^#{1,6}\s/.test(line)) return [];
      if (sectionHeaders.test(line)) return [];
      const m = line.match(bulletMatch);
      const content = m ? m[1]!.trim() : line;
      if (/^[#\-\*]+$/.test(content)) return [];
      if (/^\d+[\.\)\:\-\s]/.test(content))
        return [parseStickerPhraseLine(content.replace(/^\s*\d+[\.\)\:\-\s]+/, '').trim())];
      return [parseStickerPhraseLine(content)];
    })
    .map((line) => (line === '' ? '' : line));

  logger.log(
    '[gemini-3-flash] Parsed phrase count:',
    lines.length,
    '| Parsed lines:',
    lines
  );

  if (lines.length === 0) return [];
  if (totalFrames <= 0) return [];
  if (totalFrames === 1) {
    return [lines[0] ?? '...'];
  }

  const normalCount = totalFrames;
  const rawMain = lines;
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of rawMain) {
    const key = line.trim();
    if (key === '') {
      unique.push('');
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
  }
  const mainPhrases: string[] = [];
  if (unique.length >= normalCount) {
    mainPhrases.push(...unique.slice(0, normalCount));
  } else {
    for (let i = 0; i < normalCount; i++) {
      mainPhrases.push(unique[i % unique.length] ?? '...');
    }
  }
  let result = [...mainPhrases];

  if (result.length < totalFrames) {
    const pad = totalFrames - result.length;
    const source = mainPhrases.length > 0 ? mainPhrases : ['...'];
    for (let i = 0; i < pad; i++) result.push(source[i % source.length]!);
    logger.warn(
      '[gemini-3-flash] Result was short by',
      pad,
      '- padded to',
      totalFrames
    );
  } else if (result.length > totalFrames) {
    result = result.slice(0, totalFrames);
    logger.warn(
      '[gemini-3-flash] Result was long - sliced to',
      totalFrames
    );
  }

  logger.log(
    '[gemini-3-flash] Final: unique from model =',
    unique.length,
    '| contentCount =',
    normalCount,
    '| result length =',
    result.length,
    '(totalFrames =',
    totalFrames,
    ')'
  );

  return polishStickerPhrases(clampStickerPhrases(result, language), language);
}
