/**
 * Generates one action description per sticker phrase (pose/expression for LINE stickers).
 */

import { GoogleGenAI } from '@google/genai';
import { PHRASE_GENERATION_MODEL } from '../../utils/constants';

export interface ActionDescriptionContext {
  themeContext?: string;
  language?: string;
  nearDuplicateThreshold?: number;
}

export type ActionDedupeStrength = 'conservative' | 'balanced' | 'aggressive';

export const ACTION_DEDUPE_THRESHOLD_BY_STRENGTH: Record<
  ActionDedupeStrength,
  number
> = {
  conservative: 0.8,
  balanced: 0.66,
  aggressive: 0.5,
};

function extractJsonArrayText(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start < 0 || end < start) return null;
  return candidate.slice(start, end + 1);
}

export function parseActionDescriptionsFromText(text: string): string[] {
  const jsonArrayText = extractJsonArrayText(text);
  if (jsonArrayText) {
    try {
      const parsed = JSON.parse(jsonArrayText) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
              const action = (item as { action?: unknown }).action;
              if (typeof action === 'string') return action.trim();
            }
            return '';
          })
          .filter((line) => line.length > 0);
      }
    } catch (_) {}
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\s*\d+[\.\)\:\-\s]+/, '').trim())
    .filter((line) => line.length > 0);
}

export function normalizeActionKey(action: string): string {
  return action
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeActionToken(token: string): string {
  const trimmed = token.trim().toLowerCase();
  if (!trimmed) return '';

  const synonymMap: Record<string, string> = {
    waving: 'wave',
    waved: 'wave',
    smiles: 'smile',
    smiling: 'smile',
    smiled: 'smile',
    nodding: 'nod',
    nodded: 'nod',
    raised: 'raise',
    raising: 'raise',
    tilted: 'tilt',
    tilting: 'tilt',
    laughing: 'laugh',
    laughed: 'laugh',
    giggling: 'laugh',
  };
  if (synonymMap[trimmed]) return synonymMap[trimmed];

  if (trimmed.length > 4 && trimmed.endsWith('ing')) {
    return trimmed.slice(0, -3);
  }
  if (trimmed.length > 3 && trimmed.endsWith('ed')) {
    return trimmed.slice(0, -2);
  }
  if (trimmed.length > 3 && trimmed.endsWith('s')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function buildActionTokenSet(action: string): Set<string> {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'with',
    'and',
    'to',
    'in',
    'of',
    'while',
  ]);
  return new Set(
    normalizeActionKey(action)
      .split(/\s+/)
      .map((token) => normalizeActionToken(token))
      .filter((token) => token.length > 0 && !stopWords.has(token))
  );
}

function computeJaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isNearDuplicateAction(
  candidate: string,
  existingActions: string[],
  threshold = 0.66
): boolean {
  const candidateKey = normalizeActionKey(candidate);
  if (!candidateKey) return true;

  const candidateTokens = buildActionTokenSet(candidate);
  for (const current of existingActions) {
    const currentKey = normalizeActionKey(current);
    if (!currentKey) continue;
    if (candidateKey === currentKey) return true;

    const similarity = computeJaccardSimilarity(
      candidateTokens,
      buildActionTokenSet(current)
    );
    if (similarity >= threshold) return true;
  }
  return false;
}

function categorizePhrase(phrase: string): string {
  const normalized = phrase.toLowerCase();
  const checks: Array<{ category: string; keywords: string[] }> = [
    { category: 'thanks', keywords: ['謝', '感謝', 'thanks', 'thank', 'ありがと'] },
    { category: 'apology', keywords: ['抱歉', '對不起', 'sorry', 'sumimasen', 'すみません'] },
    { category: 'wait', keywords: ['等', '稍等', 'wait', 'hold on', '待って'] },
    { category: 'refuse', keywords: ['不要', '不行', 'no', 'nope', 'だめ'] },
    { category: 'ok', keywords: ['好', 'ok', 'okay', '收到', '了解', 'はい'] },
    { category: 'laugh', keywords: ['哈', '笑', 'lol', 'haha', 'www'] },
    { category: 'cry', keywords: ['哭', '嗚', 'sad', 'qq', '泣'] },
    { category: 'angry', keywords: ['怒', '氣', '崩潰', 'mad', 'angry', 'rage'] },
    { category: 'love', keywords: ['愛', '喜歡', '想你', 'love', 'heart', '好き'] },
    { category: 'surprised', keywords: ['驚', '震驚', '蛤', 'what', 'eh', 'えっ'] },
  ];

  for (const rule of checks) {
    if (rule.keywords.some((word) => normalized.includes(word.toLowerCase()))) {
      return rule.category;
    }
  }
  return 'default';
}

export function buildDeterministicActionFallback(
  phrase: string,
  index: number
): string {
  const category = categorizePhrase(phrase);
  const options: Record<string, string[]> = {
    thanks: ['slight bow with warm smile', 'hands together in gratitude'],
    apology: ['head lowered with apologetic eyes', 'palms together saying sorry'],
    wait: ['raise one hand to pause', 'point at wrist as waiting gesture'],
    refuse: ['cross arms and shake head', 'push palm forward to decline'],
    ok: ['thumbs up with confident smile', 'nod firmly with relaxed posture'],
    laugh: ['laughing with closed eyes', 'cover mouth while giggling'],
    cry: ['teary eyes with small frown', 'wiping tears with one hand'],
    angry: ['furrowed brows with clenched fist', 'pouting face with arms akimbo'],
    love: ['forming heart gesture with hands', 'hugging self with gentle smile'],
    surprised: ['wide eyes with raised eyebrows', 'leaning back in surprise'],
    default: [
      'natural cheerful pose with open palm',
      'relaxed stance with friendly smile',
      'slight head tilt with expressive eyes',
      'one-hand gesture with bright expression',
    ],
  };
  const bucket = options[category] ?? options.default;
  return bucket[index % bucket.length] ?? options.default[0]!;
}

export function postProcessActionDescriptions(
  candidates: string[],
  phrases: string[],
  nearDuplicateThreshold = ACTION_DEDUPE_THRESHOLD_BY_STRENGTH.balanced
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (let index = 0; index < phrases.length; index += 1) {
    const candidate = candidates[index]?.trim() ?? '';
    const fallback = buildDeterministicActionFallback(phrases[index] ?? '', index);
    const primary = candidate.length > 0 ? candidate : fallback;
    const primaryKey = normalizeActionKey(primary);

    if (
      primaryKey.length > 0 &&
      !seen.has(primaryKey) &&
      !isNearDuplicateAction(primary, result, nearDuplicateThreshold)
    ) {
      seen.add(primaryKey);
      result.push(primary);
      continue;
    }

    const backup = buildDeterministicActionFallback(phrases[index] ?? '', index + 1);
    const backupKey = normalizeActionKey(backup);
    if (
      backupKey.length > 0 &&
      !seen.has(backupKey) &&
      !isNearDuplicateAction(backup, result, nearDuplicateThreshold)
    ) {
      seen.add(backupKey);
      result.push(backup);
      continue;
    }

    let suffix = 2;
    let finalAction = `${backup} ${suffix}`;
    while (
      seen.has(normalizeActionKey(finalAction)) ||
      isNearDuplicateAction(finalAction, result, nearDuplicateThreshold)
    ) {
      suffix += 1;
      finalAction = `${backup} ${suffix}`;
    }
    seen.add(normalizeActionKey(finalAction));
    result.push(finalAction);
  }

  return result;
}

export async function generateActionDescriptions(
  apiKey: string,
  phrases: string[],
  context: ActionDescriptionContext = {},
  model: string = PHRASE_GENERATION_MODEL
): Promise<string[]> {
  if (!apiKey) throw new Error('API Key is missing');
  if (phrases.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });
  const list = phrases
    .map((p, i) => `${i + 1}. ${p.trim() ? p : '(visual-only — no on-image text)'}`)
    .join('\n');
  const themeContext = context.themeContext?.trim() ?? '';
  const language = context.language?.trim() ?? '';
  const nearDuplicateThreshold =
    context.nearDuplicateThreshold ??
    ACTION_DEDUPE_THRESHOLD_BY_STRENGTH.balanced;

  const prompt = `You are an expert at describing character poses and expressions for LINE stickers.

Given the following list of sticker slots (caption text or visual-only), output exactly ONE action description per slot, in the same order.

Theme context: ${themeContext || 'General chat context'}
Phrase language: ${language || 'Unknown'}

**Rules (important):**
- Describe only visible, drawable pose/expression: gesture (e.g. waving, thumbs up), face (e.g. smiling, eyes closed), or posture (e.g. tilting head). Avoid abstract moods without a clear visual.
- Each action must be concrete and specific so an illustrator can draw it.
- Every line must be visually distinct—no two cells should describe the same pose or expression.
- For **visual-only** slots (no on-image text), focus on a strong reaction pose or expression; do not mention text or captions.
- For captioned slots, match the phrase meaning in the pose/expression.
- Keep each action short (3-8 words preferred), concrete, and drawable.

**Output format (strict):**
- Return JSON only (no markdown, no explanation).
- JSON must be an array with exactly ${phrases.length} objects.
- Each object format: {"phrase":"<original phrase>", "action":"<english action description>"}.

**Phrases:**
${list}

**Output JSON now:**`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      temperature: 0.7,
      maxOutputTokens: 8192,
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

  const parsedLines = parseActionDescriptionsFromText(text);
  return postProcessActionDescriptions(
    parsedLines,
    phrases,
    nearDuplicateThreshold
  );
}
