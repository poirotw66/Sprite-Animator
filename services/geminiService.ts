import { GoogleGenAI } from "@google/genai";
import { isQuotaError as checkQuotaError } from '../types/errors';
import { logger } from '../utils/logger';
import { CHROMA_KEY_COLORS, PHRASE_GENERATION_MODEL, type ImageResolution, type StickerPhraseMode } from '../utils/constants';
import type { ChromaKeyColorType } from '../types';

export type ProgressCallback = (status: string) => void;

/** Message thrown when API key is missing; UI can detect this to open Settings. */
export const API_KEY_MISSING_MESSAGE = 'API Key is missing. Please add your key in Settings (gear icon).';

// Helper for delay
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes background color in AI-generated images to exact chroma key color.
 * AI models often generate slightly different shades of the target color,
 * which causes chroma key removal to fail. This function detects and replaces
 * similar colors with the exact target color.
 * 
 * @param base64Image - Base64 encoded image with approximate background color
 * @param targetColor - Exact chroma key color to normalize to
 * @param colorType - Type of chroma key color ('magenta' or 'green')
 * @returns Promise resolving to base64 image with normalized background color
 */
async function normalizeBackgroundColor(
  base64Image: string,
  targetColor: { r: number; g: number; b: number },
  colorType: ChromaKeyColorType
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Use more permissive tolerance for detection
      const tolerance = 100; // Increased from 80 for better coverage
      let normalizedCount = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const a = data[i + 3]!;

        // Skip fully transparent pixels
        if (a === 0) continue;

        let isBackgroundColor = false;

        if (colorType === 'magenta') {
          // Detect magenta-like colors - strict detection
          // Only match pure/bright magenta to avoid false positives
          const isPureMagenta = r > 200 && g < 60 && b > 200 && (r + b) > (g * 3);
          const isMagentaScreen = r > 180 && g < 80 && b > 180 && (r - g) > 120 && (b - g) > 120;
          const isBrightMagentaScreen = r > 220 && g < 100 && b > 220 && (r + b) > g * 4;
          const isNeonMagenta = r > 230 && g < 80 && b > 230;

          const distance = Math.sqrt(
            Math.pow(r - targetColor.r, 2) +
            Math.pow(g - targetColor.g, 2) +
            Math.pow(b - targetColor.b, 2)
          );

          isBackgroundColor = isPureMagenta ||
            isMagentaScreen ||
            isBrightMagentaScreen ||
            isNeonMagenta ||
            distance < tolerance;

        } else if (colorType === 'green') {
          // Detect green-like colors
          // More permissive to catch AI-generated green variants
          const isPureGreen = g > 150 && r < 100 && b < 100;
          const isStandardGreenScreen = g > 100 && r < 130 && b < 130 && g > r * 1.2 && g > b * 1.2;
          const isBrightGreenScreen = g > 140 && r < 120 && b < 120 && g > r + 40 && g > b + 40;
          const isNeonGreen = g > 180 && r < 100 && b < 100;
          const isGreenVariant = g > 80 && g > r * 1.3 && g > b * 1.3 && r < 150 && b < 150;

          const distance = Math.sqrt(
            Math.pow(r - targetColor.r, 2) +
            Math.pow(g - targetColor.g, 2) +
            Math.pow(b - targetColor.b, 2)
          );

          isBackgroundColor = isPureGreen ||
            isStandardGreenScreen ||
            isBrightGreenScreen ||
            isNeonGreen ||
            isGreenVariant ||
            distance < tolerance;
        }

        // Replace with exact target color
        if (isBackgroundColor) {
          data[i] = targetColor.r;
          data[i + 1] = targetColor.g;
          data[i + 2] = targetColor.b;
          // Keep original alpha for anti-aliasing edges
          normalizedCount++;
        }
      }

      logger.debug('Color normalization completed', {
        totalPixels: data.length / 4,
        normalizedPixels: normalizedCount,
        percentage: ((normalizedCount / (data.length / 4)) * 100).toFixed(2) + '%'
      });

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('Failed to load image for color normalization'));
    img.src = base64Image;
  });
}

// Helper to check if error is related to quota or overloading
const isQuotaError = (error: unknown): boolean => {
  return checkQuotaError(error);
};

// Helper for retrying operations with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  onStatusUpdate?: (msg: string) => void,
  retries = 5,
  baseDelay = 4000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      if (isQuotaError(error) && i < retries - 1) {
        // Backoff: 4s, 8s, 16s... covering the 3.6s window from the start
        const delay = baseDelay * Math.pow(2, i) + (Math.random() * 1000);
        const waitSeconds = Math.round(delay / 1000);

        logger.warn(`Rate limit/Overload hit (Attempt ${i + 1}/${retries}). Retrying in ${waitSeconds}s...`);
        if (onStatusUpdate) {
          onStatusUpdate(`API 繁忙 (429/503)，等待 ${waitSeconds} 秒後重試... (嘗試 ${i + 1}/${retries})`);
        }

        await wait(delay);
        continue;
      }

      // If it's not a recoverable error, throw immediately
      throw error;
    }
  }
  throw lastError;
}

/**
 * Determines the optimal Aspect Ratio for a given grid configuration.
 * Finds the supported Gemini aspect ratio closest to the grid's natural shape (cols/rows).
 * 
 * @param cols - Number of columns in the sprite sheet grid
 * @param rows - Number of rows in the sprite sheet grid
 * @returns The closest supported aspect ratio string (e.g., "1:1", "4:3", "16:9")
 * 
 * @example
 * ```typescript
 * const ratio = getBestAspectRatio(4, 4); // Returns "1:1"
 * const ratio = getBestAspectRatio(4, 3); // Returns "4:3"
 * ```
 */
function getBestAspectRatio(cols: number, rows: number): string {
  const targetRatio = cols / rows;

  // Supported ratios by Gemini 2.5 Flash Image / Imagen
  const supported = [
    { str: "1:1", val: 1.0 },
    { str: "3:4", val: 0.75 },
    { str: "4:3", val: 1.333 },
    { str: "9:16", val: 0.5625 },
    { str: "16:9", val: 1.778 },
  ];

  // Find closest ratio to prevent squashing/stretching sprites
  return supported.reduce((prev, curr) =>
    Math.abs(curr.val - targetRatio) < Math.abs(prev.val - targetRatio) ? curr : prev
  ).str;
}

/**
 * Generates an animation storyboard by breaking down the action into sequential keyframes.
 * Uses Gemini's multimodal capabilities to analyze the character and create a frame-by-frame plan.
 * 
 * @param ai - Initialized GoogleGenAI instance
 * @param imageBase64 - Base64 encoded source character image
 * @param userPrompt - User's animation prompt (e.g., "Run Cycle", "Jump")
 * @param frameCount - Number of frames to generate in the storyboard
 * @param onProgress - Optional callback to report progress status
 * @returns Promise resolving to an array of frame descriptions
 * 
 * @throws {Error} If storyboard generation fails and fallback also fails
 * 
 * @example
 * ```typescript
 * const storyboard = await getAnimationStoryboard(
 *   ai,
 *   base64Image,
 *   "Run Cycle",
 *   8,
 *   (status) => console.log(status)
 * );
 * ```
 */
async function getAnimationStoryboard(
  ai: GoogleGenAI,
  imageBase64: string,
  userPrompt: string,
  frameCount: number,
  onProgress?: ProgressCallback
): Promise<string[]> {
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  if (onProgress) onProgress("正在規劃動作分鏡 (Storyboard)...");

  // Use a text/multimodal model for planning. 
  // 'gemini-2.5-flash' is the standard text/multimodal model.
  const planningModel = 'gemini-2.5-flash';

  const systemPrompt = `You are a professional 2D Frame-by-Frame Animator. 
  Breakdown the action "${userPrompt}" into EXACTLY ${frameCount} sequential keyframes.
  
  Rules:
  1. Output a plain NUMBERED LIST.
  2. No Markdown, No JSON, No intro text.
  3. Example:
     1. Character prepares to jump
     2. Character in mid-air
  `;

  try {
    const response = await retryOperation(async () => {
      return await ai.models.generateContent({
        model: planningModel,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
            { text: systemPrompt }
          ]
        },
        config: {
          temperature: 1,
          maxOutputTokens: 1000,
        }
      });
    }, onProgress);

    const text = response.text || "";

    // Parse the text output
    const lines = text.split('\n').filter(line => /^\d+[\.:]/.test(line.trim()));

    let storyboard = lines.map(line => line.replace(/^\d+[\.:]\s*/, '').trim());

    // Fallback parsing
    if (storyboard.length === 0) {
      storyboard = text.split('\n').filter(l => l.trim().length > 5);
    }

    // Strict slicing to ensure we don't exceed requested frame count
    if (storyboard.length > frameCount) {
      storyboard = storyboard.slice(0, frameCount);
    }

    // Padding if too few frames
    if (storyboard.length < frameCount) {
      while (storyboard.length < frameCount) {
        storyboard.push(storyboard.length > 0 ? storyboard[storyboard.length - 1] : userPrompt);
      }
    }
    return storyboard;

  } catch (e: unknown) {
    if (isQuotaError(e)) {
      logger.error("Quota exceeded during storyboard generation. Aborting.");
      throw e;
    }

    logger.warn("Storyboard generation failed (non-quota error), falling back to algorithmic descriptions.", e);
    // Fallback descriptions for non-critical errors (e.g. parsing issues)
    return Array.from({ length: frameCount }, (_, i) => {
      const progress = i / (frameCount - 1 || 1);
      if (progress < 0.2) return `Preparation: ${userPrompt}`;
      if (progress < 0.8) return `Action: ${userPrompt}`;
      return `Recovery: ${userPrompt}`;
    });
  }
}

/**
 * Generates short phrases for LINE stickers based on chat theme, language, and total frame count.
 * Uses a text-generation model (e.g. gemini-3-flash-preview).
 *
 * @param apiKey - Gemini API key
 * @param themeContext - Chat theme/context (e.g. "TRPG 跑團", "日常聊天", or custom description)
 * @param language - Language for phrases (e.g. "繁體中文", "English")
 * @param totalFrames - Number of phrases to generate (usually cols × rows of the sticker grid)
 * @param mode - Phrase generation mode (balanced/emotional/meme/interaction/theme-deep)
 * @param model - Optional model name; defaults to PHRASE_GENERATION_MODEL
 * @returns Promise resolving to array of phrase strings (one per line, 2-6 chars Chinese or 1-3 words English)
 */
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

  const contentCount = Math.max(1, totalFrames); // all frames from model (no KKT/KKO reserved)
  let n40 = Math.round(contentCount * 0.4);
  let n30 = Math.round(contentCount * 0.3);
  let n20 = Math.round(contentCount * 0.2);
  let n10 = contentCount - n40 - n30 - n20; // remainder so total = contentCount

  // Adjust category distribution based on mode
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
      // Keep golden ratio counts
      break;
  }

  let modeLabel: string;
  let modeHint: string;
  switch (mode) {
    case 'emotional':
      modeLabel = '情緒版（全部情緒）';
      modeHint = '以情緒表達為主（開心、累、煩、感動等），用字簡潔、適合貼圖，避免過度抱怨或網路用語。';
      break;
    case 'meme':
      modeLabel = '梗圖版（全部梗圖）';
      modeHint = '帶一點反差或自嘲感，但仍要簡短好懂、適合印在貼圖上；避免只有圈內人才懂的梗。';
      break;
    case 'interaction':
      modeLabel = '關係互動版（全部關係互動）';
      modeHint = '全部是對人說的話：感謝、抱歉、打氣、想你等，簡潔自然，適合朋友、情人、同事。';
      break;
    case 'theme-deep':
      modeLabel = '符合主題版（內梗向）';
      modeHint = '每句都要呼應主題，讓懂這主題的人一看就懂；用字仍保持簡潔、適合貼圖。';
      break;
    case 'balanced':
    default:
      modeLabel = '黃金比例版（平衡）';
      modeHint = '依比例分配四類短語，每類都要貼合主題。用字簡潔、好懂、適合 LINE 貼圖，避免過度鄉民或網路梗。';
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
- Relatable: users should think "I’d use this in chat."
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
  } catch (_) { }

  // Debug: log full Gemini response for sticker phrase generation (suppressed in production)
  logger.log('[gemini-3-flash] Sticker phrases raw response | text length =', text.length);
  logger.log('[gemini-3-flash] Full text used for parsing:', text);
  try {
    const res = response as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (res.candidates?.[0]) {
      logger.log('[gemini-3-flash] finishReason (MAX_TOKENS = truncated) =', res.candidates[0].finishReason);
    }
  } catch (_) { }

  const sectionHeaders = /^(萬用日常|情緒爆發|關係互動|梗圖型|Universal Daily|Emotional Outburst|Social Interaction|Meme\/Iconic)\s*[：:]\s*$/i;
  const bulletMatch = /^\s*[-*]\s*(.+)$/;
  const lines = text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      if (sectionHeaders.test(line)) return [];
      const m = line.match(bulletMatch);
      if (m) return [m[1].trim()];
      if (/^[#\-\*]+$/.test(line)) return [];
      if (/^\d+[\.\)\:\-\s]/.test(line)) return [line.replace(/^\s*\d+[\.\)\:\-\s]+/, '').trim()];
      return [line];
    })
    .filter((line) => line.length > 0);

  logger.log('[gemini-3-flash] Parsed phrase count:', lines.length, '| Parsed lines:', lines);

  if (lines.length === 0) return [];

  if (totalFrames <= 0) return [];
  if (totalFrames === 1) {
    return [lines[0] ?? '...'];
  }

  // All frames from model (no KKT/KKO) — enforce exact count totalFrames
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

  // Guarantee length is exactly totalFrames (pad or slice)
  if (result.length < totalFrames) {
    const pad = totalFrames - result.length;
    const source = mainPhrases.length > 0 ? mainPhrases : ['...'];
    for (let i = 0; i < pad; i++) result.push(source[i % source.length]);
    logger.warn('[gemini-3-flash] Result was short by', pad, '- padded to', totalFrames);
  } else if (result.length > totalFrames) {
    result = result.slice(0, totalFrames);
    logger.warn('[gemini-3-flash] Result was long - sliced to', totalFrames);
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

/**
 * Ask Gemini to generate one action description per phrase (for LINE sticker pose/expression).
 * Returns array in same order as input; each item is "English (中文)" format.
 */
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
- One line per phrase. Each line: English description (中文描述)
- No numbering, no bullets, no extra text. Only the "English (中文)" line.
- Example lines:
  waving hand (揮手)
  thumbs up with smile (比讚微笑)
  tilting head confused (歪頭困惑)

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
      padded.push(lines[padded.length % lines.length] ?? 'natural pose (自然動作)');
    }
    return padded.slice(0, phrases.length);
  }
  return phrases.map(() => 'natural action and expression matching the text meaning (自然動作與表情符合語意)');
}

/**
 * Generates a single sprite sheet image containing multiple animation frames in a grid layout.
 * This is much more quota-efficient than frame-by-frame generation (only 1 API request).
 * 
 * @param imageBase64 - Base64 encoded source character image
 * @param prompt - Animation action description (e.g., "Run Cycle", "Jump")
 * @param cols - Number of columns in the sprite sheet grid
 * @param rows - Number of rows in the sprite sheet grid
 * @param apiKey - Gemini API key for authentication
 * @param model - Model name to use (e.g., "gemini-2.5-flash-image" or "gemini-3-pro-image-preview")
 * @param onProgress - Optional callback to report generation progress
 * @returns Promise resolving to base64 encoded sprite sheet image
 * 
 * @throws {Error} If API key is missing or image generation fails
 * 
 * @example
 * ```typescript
 * const spriteSheet = await generateSpriteSheet(
 *   base64Image,
 *   "Run Cycle",
 *   4,
 *   4,
 *   apiKey,
 *   "gemini-2.5-flash-image",
 *   (status) => console.log(status)
 * );
 * ```
 */
export const generateSpriteSheet = async (
  imageBase64: string,
  prompt: string,
  cols: number,
  rows: number,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  chromaKeyColor: ChromaKeyColorType = 'green',
  outputResolution?: ImageResolution
): Promise<string> => {
  if (!apiKey) throw new Error(API_KEY_MISSING_MESSAGE);

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Get the selected background color
  const bgColor = CHROMA_KEY_COLORS[chromaKeyColor];
  const bgColorName = chromaKeyColor === 'magenta' ? 'pure magenta/fuchsia' : 'chroma key green';
  const bgColorHex = bgColor.hex;
  // RGB values for explicit color specification
  const bgColorRGB = `RGB(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  // 1. Determine best aspect ratio config to force correct layout
  const targetAspectRatio = getBestAspectRatio(cols, rows);

  // Calculate total frames and timing
  const totalFrames = cols * rows;

  // Check if this is a LINE sticker prompt (contains specific markers)
  const isLineStickerPrompt = prompt.includes('LINE 貼圖') ||
    prompt.includes('LINE sticker') ||
    prompt.includes('表情貼圖') ||
    prompt.includes('每一格的具體分配');

  let fullPrompt: string;

  if (isLineStickerPrompt) {
    // Use the provided LINE sticker prompt directly
    // Add background color + strict layout enforcement to reduce randomness
    const bgColorRequirement = `
---

### 【背景顏色要求（CRITICAL）】

背景必須是純色 **${bgColorHex}**（${bgColorRGB}），用於後續去背處理。
不得出現場景、漸變、陰影或其他背景元素。

${chromaKeyColor === 'magenta'
        ? `⚠️ MAGENTA REQUIREMENT:
  • R = 255, G = 0, B = 255
  • 必須是純洋紅色 #FF00FF，不是粉色或紫色

⚠️ 去背友善（避免文字處殘留）：
  • 文字與角色輪廓、陰影**禁止使用**洋紅、粉紅、紫色或任何接近 #FF00FF 的顏色
  • 僅使用黑色、白色或與洋紅對比明顯的深色（如深灰、深藍、深棕），避免去背後在文字邊緣產生洋紅殘留`
        : `⚠️ GREEN SCREEN REQUIREMENT:
  • R = 0, G = 177, B = 64
  • 必須是標準綠幕 #00B140，不是青綠色或草綠色`}

背景的每個像素都必須是 EXACTLY ${bgColorHex}。
`;

    const layoutEnforcement = `
---

### 【輸出格式強制（OUTPUT FORMAT - MUST FOLLOW）】

1. **網格**：整張圖必須可被精確均分為 **${cols} 欄 × ${rows} 列**，共 **${totalFrames} 格**。從左到右、從上到下每格等大，無外圍留白、無格與格之間的縫隙或線條。
2. **禁止框線**：不得繪製任何 框線、格線、邊框、分隔線 或 格子外框。格與格之間只能是一片連續背景色，不能有任何可見的線條或框。
3. **填滿**：每一格內角色與文字需佔滿大部分面積（角色約佔格高 70%～85%），單格內僅保留極少內邊距，禁止「角色很小、周圍一大片空白」的構圖。
4. **一致性**：所有格子的尺寸與對齊方式必須一致，使後續可依固定比例裁成 ${cols}×${rows} 張獨立貼圖。
`;

    fullPrompt = prompt + bgColorRequirement + layoutEnforcement;

    if (onProgress) onProgress(`正在生成 ${cols}x${rows} LINE 貼圖精靈圖 (比例 ${targetAspectRatio})...`);
  } else {
    const cellWidthPct = Math.round(100 / cols);
    const cellHeightPct = Math.round(100 / rows);
    // Per-cell list in LINE style: **Cell N (row R, col C)**: Action | timing (do NOT draw numbers on image)
    const cellDescriptions = Array.from({ length: totalFrames }, (_, i) => {
      const progress = i / totalFrames;
      const degrees = Math.round(progress * 360 / totalFrames * 10) / 10;
      const row = Math.floor(i / cols) + 1;
      const col = (i % cols) + 1;
      return `**Cell ${i + 1} (row ${row}, col ${col})**: Action: "${prompt}" | ${degrees}° into motion cycle. TINY change from previous cell.`;
    }).join('\n');

    const bgColorNameExact = chromaKeyColor === 'magenta' ? 'Pure Magenta #FF00FF' : 'Neon Green #00FF00';

    // 2. Construct prompt: LINE-style order [1] Layout → [2] Style → [3] Subject → [4] Background → [5] Task & Per-cell → [6] Final Goal → [7] Forbidden
    fullPrompt = `
🎨 Character Animation Sprite Sheet Generation

### [1. Global Layout] CRITICAL

* **Canvas**: Grid aspect ${cols}×${rows}. High resolution output. No letterboxing—image edges = grid boundaries.
* **Grid**: ${cols}×${rows} = ${totalFrames} cells. Each cell exactly **${cellWidthPct}% of image width** and **${cellHeightPct}% of image height**.
* **Margins**: None. No empty space at left, right, top, or bottom.
* **Gaps**: No gaps between cells. Adjacent cells share the same boundary. Do NOT draw any dividers, borders, frame lines (框線), or grid lines (格線) between or around cells.
* **Forbidden**: No visible 框線, 格線, 邊框, or 分隔線 anywhere. The grid is invisible—only the background color fills the space.
* **Output**: The image MUST be perfectly splittable into ${totalFrames} equal rectangles.
* **Per cell**: Character must occupy ~70–85% of cell height. Do NOT draw a box, frame, or border around each cell. Minimum internal padding ~5–10%. Character must NOT cross grid lines or touch adjacent cells. One independent pose per cell.

### [2. Style / Art Medium]

* **Lighting (technical)**: Flat shading only. No drop shadows, no gradients, no ambient occlusion. Sharp edges against background.
* **No 框線 or grid separators**: Do NOT draw any line, frame, border, box, or divider between cells or around the image or around each pose. The grid is logical only (for splitting later); adjacent cells must share the same background with zero visible lines.

### [3. Subject / Character] CRITICAL — Image is primary

* **Primary reference**: The **uploaded image is the main source**. Draw **this exact character**: same face, hair, outfit, color palette, proportions, and recognisable features. Do not replace them with a generic character.
* **Consistency**: Invariants = face proportions, skin tone, hair silhouette, main outfit, color scheme. Variants = pose, expression, limb positions only (micro changes between cells).

### [4. Lighting & Background] CRITICAL

* **Background color (exact)**: The entire canvas must be **exactly ${bgColorNameExact}** (hex ${bgColorHex}). Every cell must use this same color—no gradients, no pink/purple/green variants (e.g. do NOT use #E91E63 or similar). One single RGB value for all background pixels so that chroma key removal works uniformly.
* **Lighting**: No shadows. Flat shading only. Ambient occlusion disabled.
* **Uniform**: Same color across the entire sprite sheet. No ground, clouds, or decorative elements. Character edges must be sharp and clean against the background.
* Do NOT use similar colors—ONLY the EXACT hex ${bgColorHex} (${bgColorRGB}). Every background pixel MUST be this value.

### [5. Task & Motion]

Action: "${prompt}"
Layout: ${totalFrames} poses in a ${cols}×${rows} grid (left→right, top→bottom). Order: row by row, each cell exactly ${cellWidthPct}% width × ${cellHeightPct}% height.

**THE MOST IMPORTANT RULE**: Imagine recording a video at ${totalFrames * 4} FPS, then keeping only every 4th frame. Each cell should look almost IDENTICAL to its neighbors. The difference between one cell and the next should be BARELY NOTICEABLE. If someone quickly glances at all ${totalFrames} cells, they should think: "These all look almost the same—just tiny differences." This is CORRECT for smooth animation.

**Grid Content — Per Cell** (do NOT draw cell numbers, numerals, or labels on the image):
${cellDescriptions}

Between ANY two consecutive cells:
• Limbs rotate by only ~${Math.max(3, Math.round(15 / totalFrames))}° to ${Math.max(5, Math.round(25 / totalFrames))}° MAX
• Body shifts by only ~${Math.max(1, Math.round(5 / totalFrames))}% to ${Math.max(2, Math.round(8 / totalFrames))}% of height MAX
• Head tilts by only ~${Math.max(1, Math.round(5 / totalFrames))}° to ${Math.max(2, Math.round(8 / totalFrames))}° MAX
• Facial expression: NO change or microscopic change only
(THESE ARE MAXIMUM VALUES—smaller is better.)

Onion skin test: Overlaying the first and second cell at 50% opacity should look like ONE slightly blurry figure, not two separate poses. Overlaying all ${totalFrames} cells should look like ONE character with motion blur.

For "${prompt}": arm swing per cell ~${Math.round(45 / totalFrames)}°; body bob per cell ~${Math.round(10 / totalFrames)}%; foot movement per cell ~${Math.round(15 / totalFrames)}%. Think: "Is this change small enough to be smooth at 12 FPS?"

Perfect loop: The last cell (bottom-right) → first cell (top-left) must have the SAME tiny difference as any other adjacent pair. The animation is a CIRCLE; the last cell flows INTO the first cell.

Character anchor (fixed across all cells): foot/ground contact Y, overall size, center position per cell, art style and proportions.

Common mistakes to avoid: Do not make each cell a "key pose"; make tiny increments like video frames. Do not show the full action range in one step—show 1/${totalFrames}th of the action per cell.

### [6. Final Goal]

Output a single image: ${cols}×${rows} grid, ${totalFrames} equal rectangles. Splittable at exactly ${cellWidthPct}% width and ${cellHeightPct}% height per cell. CRITICAL: No visible 框線, borders, grid lines, or separator lines—one continuous background only. One pose per cell with minimal change between cells. Do not draw any frame or line between or around cells.

### [7. Forbidden]

• NO frame numbers, cell numbers, numerals (1, 2, 3...), or text labels drawn on the image—the grid has no visible labels.
• NO borders, frames, grid lines, dividers, rectangles, or boxes around or between cells.
• NO ground line, floor line, baseline, shadow, platform, or surface under the character.
• NO horizontal or vertical lines of any color anywhere.
• NO color variations in background—ONLY EXACTLY ${bgColorHex}. No gradients.
• Background MUST be exactly ${bgColorHex} (${bgColorRGB}); any other shade will break chroma key removal.

Generate the sprite sheet with MINIMAL frame-to-frame variation.
`;

    if (onProgress) onProgress(`正在生成 ${cols}x${rows} 連貫動作精靈圖 (比例 ${targetAspectRatio})...`);
  }

  const isInvalidArgument = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('400') || msg.includes('INVALID_ARGUMENT') || msg.includes('invalid argument');
  };

  const buildConfig = (includeImageSize: boolean) => ({
    imageConfig: {
      aspectRatio: targetAspectRatio,
      ...(includeImageSize && outputResolution && { imageSize: outputResolution })
    }
  });

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    response = await retryOperation(async () => {
      return await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
            { text: fullPrompt }
          ]
        },
        config: buildConfig(true)
      });
    }, onProgress);
  } catch (firstErr) {
    if (!isInvalidArgument(firstErr)) throw firstErr;
    if (onProgress) onProgress('正在重試（略過輸出尺寸參數）...');
    try {
      response = await retryOperation(async () => {
        return await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
              { text: fullPrompt }
            ]
          },
          config: buildConfig(false)
        });
      }, onProgress);
    } catch (secondErr) {
      if (!isInvalidArgument(secondErr)) throw secondErr;
      if (onProgress) onProgress('正在重試（略過影像設定）...');
      response = await retryOperation(async () => {
        return await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
              { text: fullPrompt }
            ]
          }
        });
      }, onProgress);
    }
  }

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const generatedImage = `data:image/png;base64,${part.inlineData.data}`;

        // Post-process: Normalize background color to exact chroma key color
        if (onProgress) onProgress('正在標準化背景顏色...');
        const normalizedImage = await normalizeBackgroundColor(
          generatedImage,
          bgColor,
          chromaKeyColor
        );

        return normalizedImage;
      }
    }
  }
  throw new Error("No image data received for sprite sheet");
};

/**
 * Generates animation frames sequentially using Gemini's frame-by-frame mode.
 * Optimized for continuity by passing the previous frame as context to each generation.
 * 
 * @param imageBase64 - Base64 encoded source character image
 * @param prompt - Animation action description (e.g., "Run Cycle", "Jump")
 * @param frameCount - Number of frames to generate
 * @param apiKey - Gemini API key for authentication
 * @param model - Model name to use (e.g., "gemini-2.5-flash-image" or "gemini-3-pro-image-preview")
 * @param onProgress - Optional callback to report generation progress
 * @param interFrameDelayMs - Delay between frame generations to avoid rate limiting (default: 4000ms)
 * @returns Promise resolving to an array of base64 encoded frame images
 * 
 * @throws {Error} If API key is missing or frame generation fails
 * 
 * @example
 * ```typescript
 * const frames = await generateAnimationFrames(
 *   base64Image,
 *   "Run Cycle",
 *   8,
 *   apiKey,
 *   "gemini-2.5-flash-image",
 *   (status) => console.log(status),
 *   2000
 * );
 * ```
 */
export const generateAnimationFrames = async (
  imageBase64: string,
  prompt: string,
  frameCount: number,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  interFrameDelayMs: number = 4000
): Promise<string[]> => {

  if (!apiKey) {
    throw new Error(API_KEY_MISSING_MESSAGE);
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  // Step 1: Generate the Storyboard
  const frameDescriptions = await getAnimationStoryboard(ai, imageBase64, prompt, frameCount, onProgress);

  // Define single frame generator function with Previous Frame Context
  const generateFrame = async (frameDesc: string, i: number, prevFrameBase64: string | null) => {

    // Construct parts array for multimodal input
    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

    // 1. Original Reference
    parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
    parts.push({ text: "Reference Character (Style/Design Source)" });

    // 2. Previous Frame (if exists) for Continuity
    if (prevFrameBase64) {
      const prevClean = prevFrameBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.push({ inlineData: { mimeType: 'image/png', data: prevClean } });
      parts.push({ text: `Previous Frame ${i} (Motion Context)` });
    }

    const fullPrompt = `
    Task: Generate Frame ${i + 1} of ${frameCount} for a sprite sheet.
    Action: "${prompt}".
    Pose Description: ${frameDesc}.
    
    [STRICT RULES]
    1. STYLE: Match "Reference Character" exactly (Colors, Proportions, Shading).
    2. BACKGROUND: Solid White (#FFFFFF).
    3. CONTINUITY: ${prevFrameBase64 ? 'The new frame must logically follow "Previous Frame" to create smooth animation.' : 'Start the animation sequence.'}
    4. ANCHOR: Keep the character size and ground position consistent.
    5. FORMAT: Single character, centered.
    `;

    parts.push({ text: fullPrompt });

    const response = await retryOperation(async () => {
      return await ai.models.generateContent({
        model: model,
        contents: {
          parts: parts
        }
      });
    }, onProgress);

    const resultParts = response.candidates?.[0]?.content?.parts;
    if (resultParts) {
      for (const part of resultParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error(`No image data received for frame ${i + 1}`);
  };

  // Step 2: Generate Frames Serially
  const results: string[] = [];
  let previousFrame: string | null = null;

  if (onProgress) onProgress("分鏡規劃完成，準備繪製...");
  await wait(2000);

  for (let i = 0; i < frameDescriptions.length; i++) {
    const desc = frameDescriptions[i];
    try {
      if (onProgress) onProgress(`正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`);

      if (i > 0) {
        if (onProgress && interFrameDelayMs > 1000) {
          onProgress(`等待 API 冷卻 (${Math.round(interFrameDelayMs / 1000)}秒)... 準備繪製第 ${i + 1} 幀`);
        }
        await wait(interFrameDelayMs);

        // Re-update status after wait
        if (onProgress) onProgress(`正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`);
      }

      // Pass previousFrame to context
      const frameResult: string = await generateFrame(desc, i, previousFrame);
      results.push(frameResult);

      // Update previous frame for next iteration
      previousFrame = frameResult;

    } catch (error: unknown) {
      logger.error(`Generation failed at frame ${i + 1}`, error);
      throw error;
    }
  }

  return results;
};