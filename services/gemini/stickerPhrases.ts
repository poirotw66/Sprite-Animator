/**
 * LINE sticker phrase generation via Gemini text model.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';
import { PHRASE_GENERATION_MODEL } from '../../utils/constants';
import { clampStickerPhrases } from '../../utils/lineStickerPhraseLength';
import { polishStickerPhrases } from '../../utils/lineStickerPhraseQuality';
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

  const exampleBlock =
    examplePhrases.length > 0
      ? `\n### [Reference Example Phrases] (same theme, same language tone)\nUse only as vibe reference; invent **new** phrases in the same spirit. Do not copy or lightly tweak.\n${examplePhrases.slice(0, 16).map((p) => `- ${p}`).join('\n')}\n`
      : '';

  const voice = resolveStickerVoice(voiceKey, customVoiceContext);
  const voiceBlock = buildStickerVoicePromptBlock(voice);
  const lengthHint = voice.lengthHint ?? DEFAULT_STICKER_LENGTH_HINT;

  const prompt = `You are an expert LINE sticker copywriter. ${voice.intro} Each phrase is printed **ON the sticker** as a bold caption beside the character—still legible at thumbnail size (~15–20% cell height).

### [Objective]
- Produce exactly **${contentCount}** phrases for one coherent sticker pack matching the Theme below.
- Every phrase must **earn a tap**: reader thinks "I'll send this instead of typing."
- **Character voice first** — match the Voice section; NOT neutral utility text unless Voice says so.
- Spread **distinct moods** across the pack.

### [Theme]
${themeContext}${exampleBlock}

### [Language]
Output **${language}** only.

${voiceBlock}

### [Length — still fits ON the sticker]
${lengthHint}

### [On-sticker legibility]
- Thumbnail-first: avoid dense punctuation, quotes, parentheses, slashes, hashtags, URLs.
- **Pairable with art**: illustrator draws pose/expression from the line—concrete reactions beat abstract metaphors.
- Cover varied chat beats within the theme—but each with the chosen **Voice**.

### [Theme alignment]
- No category headers in output.
- Stay inside the Theme; no generic filler.

### [Quality bar]
- Natural spoken rhythm; Taiwanese/Japanese LINE chat flavor for zh/ja when applicable.
- No duplicate or near-synonym meanings across ${contentCount} lines.
- Each phrase works alone without context from other stickers.

### [Output format — STRICT]
Exactly **${contentCount}** lines, flat list only.
- Each line: "- " then the phrase only.
- No headings, numbering, blank lines, preamble, or sign-off.

### [Forbidden]
- Emojis, explanations, meta commentary
- Labels ("Sticker 1/48"), numbering prefixes on phrases
- Multi-clause sentences, semicolon chains

Generate the ${contentCount} phrases now.`;

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

  return polishStickerPhrases(clampStickerPhrases(result, language), language);
}
