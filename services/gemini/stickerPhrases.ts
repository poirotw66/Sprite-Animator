/**
 * LINE sticker phrase generation via Gemini text model.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';
import { PHRASE_GENERATION_MODEL, type StickerPhraseMode } from '../../utils/constants';
import { API_KEY_MISSING_MESSAGE } from './types';

export async function generateStickerPhrases(
  apiKey: string,
  themeContext: string,
  language: string,
  totalFrames: number,
  mode: StickerPhraseMode = 'balanced',
  model: string = PHRASE_GENERATION_MODEL
): Promise<string[]> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const ai = new GoogleGenAI({ apiKey });

  const contentCount = Math.max(1, totalFrames);
  let n40 = Math.round(contentCount * 0.4);
  let n30 = Math.round(contentCount * 0.3);
  let n20 = Math.round(contentCount * 0.2);
  let n10 = contentCount - n40 - n30 - n20;

  switch (mode) {
    case 'emotional':
      n40 = 0;
      n20 = 0;
      n10 = 0;
      n30 = contentCount;
      break;
    case 'meme':
      n40 = 0;
      n30 = 0;
      n20 = 0;
      n10 = contentCount;
      break;
    case 'interaction':
      n40 = 0;
      n30 = 0;
      n10 = 0;
      n20 = contentCount;
      break;
    case 'theme-deep':
    case 'balanced':
    default:
      break;
  }

  let modeLabel: string;
  let modeHint: string;
  switch (mode) {
    case 'emotional':
      modeLabel = 'Emotional (all emotional)';
      modeHint =
        'Focus on emotions (happy, tired, annoyed, moved, etc.). Keep phrases short and sticker-friendly; avoid heavy complaints or niche slang.';
      break;
    case 'meme':
      modeLabel = 'Meme (all meme-style)';
      modeHint =
        'Slight twist or self-deprecation, but keep phrases short and easy to understand for stickers; avoid inside jokes only a small group gets.';
      break;
    case 'interaction':
      modeLabel = 'Social interaction (all interaction)';
      modeHint =
        'All phrases directed at others: thanks, sorry, cheering up, missing you, etc. Natural and concise for friends, partners, colleagues.';
      break;
    case 'theme-deep':
      modeLabel = 'Theme-aligned (theme-deep)';
      modeHint =
        'Every phrase must resonate with the theme so anyone who knows the theme gets it; keep wording short and sticker-friendly.';
      break;
    case 'balanced':
    default:
      modeLabel = 'Balanced (golden ratio)';
      modeHint =
        'Distribute the four categories by ratio; each category must fit the theme. Short, clear, LINE-sticker friendly; avoid heavy internet or niche slang.';
      break;
  }

  const prompt = `You are an expert LINE sticker copywriter. Your goal is to write short, clear phrases that fit ON a sticker and are used in daily chat.

### [Objective]
Generate a set of "Sticker Phrases" for a LINE sticker set based on the Theme. Each phrase must be concise and suitable for printing on a sticker.

### [Theme]
${themeContext}

### [Language]
${language}. Output phrases in this language only.
(Chinese: at most 6 characters; English: 1–3 words.)

### [Phrase Mode]
- Mode: ${modeLabel}
- Hint: ${modeHint}

### [Output Quantity] (Strictly Follow)
Generate exactly ${contentCount} phrases, distributed as below. The total number of phrase lines (excluding category headers) must be exactly ${contentCount}.

### [Categories and Ratios] (Strictly Follow)
Label the four categories clearly:

1. Universal Daily (${n40} phrases, ~40%)
   - For everyday replies; neutral, widely usable.
   - Standalone; no context needed.

2. Emotional Outburst (${n30} phrases, ~30%)
   - Strong but clear emotions (happy, tired, annoyed, moved, etc.).
   - Usable as real chat reactions; not obscure.

3. Social Interaction (${n20} phrases, ~20%)
   - Directed at others: thanks, sorry, cheering up, missing you, etc.
   - Suitable for friends, partners, colleagues.

4. Meme/Iconic (${n10} phrases, ~10%)
   - Memorable or slightly witty; light twist or self-deprecation.
   - Prefer timeless, widely understood expressions over niche internet slang.

### [Text Style Rules] (Very Important)
- Concise and clear: easy to read at a glance on a sticker.
- Natural chat tone; avoid formal or long sentences.
- No heavy slang, niche memes, or "internet-only" jargon unless the phrase mode explicitly asks for it.
- Optimized for ON-sticker use, not for long captions.
- No repeated or near-identical phrases: each phrase must be clearly different in meaning from the others.

### [Tone and Resonance]
- Relatable: users should think "I'd use this in chat."
- Friendly and natural; avoid overly "trashy," cynical, or meme-heavy tone in the default balance.
- Every phrase must stand alone and be understood without explanation.

### [Output Format] (Strictly Follow)
Output following this format, one phrase per line starting with "- ":

Universal Daily:
- phrase
- phrase

Emotional Outburst:
- phrase
- phrase

Social Interaction:
- phrase

Meme/Iconic:
- phrase

### [Prohibitions]
❌ No explanations or analysis
❌ No emojis
❌ No filler text or "Sticker 1/2" labels
❌ No heavy internet slang, niche memes, or jargon that only a small group understands
❌ No long or complicated sentences
❌ No duplicate or near-synonym phrases across the set

Now generate the phrases based on the Theme.`;

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
      if (sectionHeaders.test(line)) return [];
      const m = line.match(bulletMatch);
      if (m) return [m[1]!.trim()];
      if (/^[#\-\*]+$/.test(line)) return [];
      if (/^\d+[\.\)\:\-\s]/.test(line))
        return [line.replace(/^\s*\d+[\.\)\:\-\s]+/, '').trim()];
      return [line];
    })
    .filter((line) => line.length > 0);

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
    if (key && !seen.has(key)) {
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

  return result;
}
