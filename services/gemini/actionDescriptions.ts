/**
 * Generates one action description per sticker phrase (pose/expression for LINE stickers).
 */

import { GoogleGenAI } from '@google/genai';
import { PHRASE_GENERATION_MODEL } from '../../utils/constants';

export async function generateActionDescriptions(
  apiKey: string,
  phrases: string[],
  model: string = PHRASE_GENERATION_MODEL
): Promise<string[]> {
  if (!apiKey) throw new Error('API Key is missing');
  if (phrases.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });
  const list = phrases.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const prompt = `You are an expert at describing character poses and expressions for LINE stickers.

Given the following list of sticker PHRASES (short text that will appear on each sticker), output exactly ONE action description per phrase, in the same order.

**Rules (important):**
- Describe only visible, drawable pose/expression: gesture (e.g. waving, thumbs up), face (e.g. smiling, eyes closed), or posture (e.g. tilting head). Avoid abstract moods without a clear visual.
- Each action must be concrete and specific so an illustrator can draw it.
- Every line must be visually distinct—no two cells should describe the same pose or expression.

**Output format (strict):**
- One line per phrase. Each line: English description only (optionally with translation in parentheses).
- No numbering, no bullets, no extra text. Only the description line.
- Example lines:
  waving hand
  thumbs up with smile
  tilting head confused

**Phrases:**
${list}

**Output (exactly ${phrases.length} lines, one per phrase):**`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text ?? '';
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\s*\d+[\.\)\:\-\s]+/, '').trim())
    .filter((line) => line.length > 0);

  if (lines.length >= phrases.length) {
    return lines.slice(0, phrases.length);
  }
  if (lines.length > 0) {
    const padded = [...lines];
    while (padded.length < phrases.length) {
      padded.push(
        lines[padded.length % lines.length] ?? 'natural pose'
      );
    }
    return padded.slice(0, phrases.length);
  }
  return phrases.map(
    () =>
      'natural action and expression matching the text meaning'
  );
}
