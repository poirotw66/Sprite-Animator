/**
 * Generate a one-line character concept + short Traditional Chinese name via Gemini text.
 */

import { GoogleGenAI } from '@google/genai';

import { PHRASE_GENERATION_MODEL } from '../../utils/constants';
import { THEME_PRESETS } from '../../utils/lineStickerPresets';
import { STICKER_VOICE_PRESETS } from '../../utils/lineStickerVoicePresets';
import { resolveDailyPackStyleKey, type DailyPackStyleKey } from '../../utils/dailyPackPresets';
import { API_KEY_MISSING_MESSAGE } from './types';

export interface CharacterConceptInput {
  theme: string;
  voice: string;
  style: DailyPackStyleKey | string;
  excludeConcepts?: string[];
}

export interface CharacterConceptResult {
  characterName: string;
  characterConcept: string;
}

export function parseCharacterConceptResponse(text: string): CharacterConceptResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        characterName?: string;
        characterConcept?: string;
      };
      const name = parsed.characterName?.trim();
      const concept = parsed.characterConcept?.trim();
      if (name && concept) {
        return { characterName: name.slice(0, 8), characterConcept: concept };
      }
    }
  } catch {
    // fall through to line parsing
  }

  const nameMatch = trimmed.match(/characterName\s*[:：]\s*["']?([^"'\n]+)["']?/i);
  const conceptMatch = trimmed.match(/characterConcept\s*[:：]\s*["']?([^"'\n]+)["']?/i);
  if (nameMatch?.[1] && conceptMatch?.[1]) {
    return {
      characterName: nameMatch[1].trim().slice(0, 8),
      characterConcept: conceptMatch[1].trim(),
    };
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return {
      characterName: lines[0]!.replace(/^[-*]\s*/, '').slice(0, 8),
      characterConcept: lines[1]!.replace(/^[-*]\s*/, ''),
    };
  }

  return null;
}

function themeLabel(themeKey: string): string {
  const preset = THEME_PRESETS[themeKey as keyof typeof THEME_PRESETS];
  return preset ? `${preset.label} (${preset.chatContext})` : themeKey;
}

function voiceLabel(voiceKey: string): string {
  const preset = STICKER_VOICE_PRESETS[voiceKey];
  return preset ? preset.label : voiceKey;
}

export async function generateCharacterConcept(
  apiKey: string,
  input: CharacterConceptInput,
  model: string = PHRASE_GENERATION_MODEL
): Promise<CharacterConceptResult> {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const stylePresetKey = resolveDailyPackStyleKey(input.style as DailyPackStyleKey);
  const excludeBlock =
    input.excludeConcepts && input.excludeConcepts.length > 0
      ? `\n### [Avoid repeating these concepts]\n${input.excludeConcepts.slice(0, 20).map((c) => `- ${c}`).join('\n')}\n`
      : '';

  const prompt = `You invent ONE original LINE sticker mascot for a new sticker pack.

### [Theme]
${themeLabel(input.theme)}

### [Voice tone]
${voiceLabel(input.voice)}

### [Art style]
${input.style} (maps to preset: ${stylePresetKey})

### [Requirements]
- characterName: 2–4 Traditional Chinese characters, catchy, not a real celebrity or copyrighted IP
- characterConcept: ONE sentence in Traditional Chinese describing species, look, personality, and a visual hook for stickers
- Must fit the theme and voice; suitable for cute/expressive LINE stickers
- Invent a fresh character — not a clone of famous mascots${excludeBlock}

### [Output — STRICT JSON only]
{"characterName":"...","characterConcept":"..."}`;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: { temperature: 0.95, maxOutputTokens: 512 },
  });

  const text = response.text ?? '';
  const parsed = parseCharacterConceptResponse(text);
  if (!parsed) {
    throw new Error(`Failed to parse character concept from model response: ${text.slice(0, 200)}`);
  }
  return parsed;
}
