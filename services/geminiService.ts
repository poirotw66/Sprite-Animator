import { GoogleGenAI } from "@google/genai";
import { isQuotaError as checkQuotaError } from '../types/errors';
import { logger } from '../utils/logger';
import { CHROMA_KEY_COLORS, PHRASE_GENERATION_MODEL, type ImageResolution } from '../utils/constants';
import type { ChromaKeyColorType } from '../types';

export type ProgressCallback = (status: string) => void;

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
        while(storyboard.length < frameCount) {
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
 * @param model - Optional model name; defaults to PHRASE_GENERATION_MODEL
 * @returns Promise resolving to array of phrase strings (one per line, 2-6 chars Chinese or 1-3 words English)
 */
export async function generateStickerPhrases(
  apiKey: string,
  themeContext: string,
  language: string,
  totalFrames: number,
  model: string = PHRASE_GENERATION_MODEL
): Promise<string[]> {
  if (!apiKey) throw new Error('API Key is missing');

  const ai = new GoogleGenAI({ apiKey });

  const contentCount = Math.max(1, totalFrames); // all frames from model (no KKT/KKO reserved)
  const n40 = Math.round(contentCount * 0.4);
  const n30 = Math.round(contentCount * 0.3);
  const n20 = Math.round(contentCount * 0.2);
  const n10 = contentCount - n40 - n30 - n20; // remainder so total = contentCount

  const prompt = `你是一位非常熟悉 LINE 貼圖市場的爆款貼圖企劃與文案設計師，
擅長設計「會被大量拿來用」的貼圖短語，而不是漂亮但沒人用的句子。

【任務目標】
根據我提供的「主題」，生成一整組可用於 LINE 貼圖的「短語清單」。

【主題】
${themeContext}

【語言】
${language}。請依此語言輸出短語（若為繁體中文則每句不超過 6 個字；英文則 1～3 個字為佳）。

【輸出數量（嚴格遵守）】
請輸出一組「共 ${contentCount} 句」的貼圖短語，並依下列比例分配：

【分類與比例（嚴格遵守）】
請將短語分成以下四類，並明確標示分類名稱：

1. 萬用日常（${n40} 句，約 40%）
   - 日常聊天一定會用到
   - 可單獨作為回覆
   - 不帶強烈情緒也能使用

2. 情緒爆發（${n30} 句，約 30%）
   - 情緒明確、可投射
   - 包含崩潰、厭世、煩躁、撐住等狀態
   - 但仍需符合「LINE 聊天實用」

3. 關係互動（${n20} 句，約 20%）
   - 對人說的話
   - 包含關心、撒嬌、道歉、安慰、想念
   - 適合朋友、情人、曖昧使用

4. 梗圖型（${n10} 句，約 10%）
   - 帶有記憶點或反差感
   - 可冷幽默、反諷、自嘲
   - 不追逐短期流行語，避免過時

【文字風格規則（非常重要）】
- 每句簡短、偏口語、聊天感
- 一眼就懂，不能解釋
- 避免書面語與完整長句
- 適合放在貼圖上，不是社群貼文

【市場適配規則】
- 假設使用者會在「已讀不回、敷衍回覆、情緒表達、快速回應」時使用
- 每一句都必須能獨立存在
- 不能依賴上下文才成立

【輸出格式（嚴格遵守）】
請依照以下格式輸出，每行一個短語，前方用「- 」：

萬用日常：
- 短語
- 短語

情緒爆發：
- 短語
- 短語

關係互動：
- 短語

梗圖型：
- 短語

【禁止事項】
❌ 不要解釋
❌ 不要分析
❌ 不要加表情符號
❌ 不要加任何多餘文字
❌ 不要標示「第幾張」

現在，請根據「主題」開始生成。`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      temperature: 0.9,
      maxOutputTokens: 4096,
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

  // Debug: log full Gemini response in F12 console for sticker phrase generation
  if (typeof console !== 'undefined' && console.group) {
    console.group('[gemini-3-flash] Sticker phrases raw response');
    console.log('text length (characters) =', text.length);
    console.log('--- full text used for parsing ---');
    console.log(text);
    try {
      const res = response as {
        candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
      };
      if (res.candidates?.[0]) {
        console.log('finishReason (MAX_TOKENS = truncated) =', res.candidates[0].finishReason);
      }
    } catch (_) {}
    console.groupEnd();
  }

  const sectionHeaders = /^(萬用日常|情緒爆發|關係互動|梗圖型)\s*[：:]\s*$/;
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

  if (typeof console !== 'undefined') {
    console.log('[gemini-3-flash] Parsed phrase count:', lines.length, '| Parsed lines:', lines);
  }

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
    if (typeof console !== 'undefined') {
      console.warn('[gemini-3-flash] Result was short by', pad, '- padded to', totalFrames);
    }
  } else if (result.length > totalFrames) {
    result = result.slice(0, totalFrames);
    if (typeof console !== 'undefined') {
      console.warn('[gemini-3-flash] Result was long - sliced to', totalFrames);
    }
  }

  if (typeof console !== 'undefined') {
    console.log(
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
  }

  return result;
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
    chromaKeyColor: ChromaKeyColorType = 'magenta',
    outputResolution?: ImageResolution
): Promise<string> => {
    if (!apiKey) throw new Error("API Key is missing");

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
2. **填滿**：每一格內角色與文字需佔滿大部分面積（角色約佔格高 70%～85%），單格內僅保留極少內邊距，禁止「角色很小、周圍一大片空白」的構圖。
3. **一致性**：所有格子的尺寸與對齊方式必須一致，使後續可依固定比例裁成 ${cols}×${rows} 張獨立貼圖。
`;
        
        fullPrompt = prompt + bgColorRequirement + layoutEnforcement;
        
        if (onProgress) onProgress(`正在生成 ${cols}x${rows} LINE 貼圖精靈圖 (比例 ${targetAspectRatio})...`);
    } else {
        // Generate detailed per-frame description with TINY increments for animation
        const frameDescriptions = Array.from({ length: totalFrames }, (_, i) => {
          const progress = i / totalFrames; // 0 to ~0.83 for 6 frames
          const degrees = Math.round(progress * 360 / totalFrames * 10) / 10;
          return `Frame ${i + 1}: ${degrees}° into the motion cycle (TINY change from ${i === 0 ? 'Frame ' + totalFrames : 'Frame ' + i})`;
        }).join('\n');
        
        // 2. Construct a prompt that enforces MINIMAL frame-to-frame changes for animation
        fullPrompt = `
You are creating a sprite sheet for ULTRA-SMOOTH looping animation.

══════════════════════════════════════════════════════════════
THE MOST IMPORTANT RULE - READ THIS FIRST
══════════════════════════════════════════════════════════════
Imagine recording a video at ${totalFrames * 4} FPS, then keeping only every 4th frame.
Each frame should look almost IDENTICAL to its neighbors.
The difference between Frame N and Frame N+1 should be BARELY NOTICEABLE.

If someone quickly glances at all ${totalFrames} frames, they should think:
"These all look almost the same - just tiny differences"

This is CORRECT. This is what makes smooth animation.

══════════════════════════════════════════════════════════════
TASK
══════════════════════════════════════════════════════════════
Action: "${prompt}"
Layout: ${totalFrames} poses in a ${cols}×${rows} grid (left→right, top→bottom)

⚠️ CRITICAL BACKGROUND COLOR REQUIREMENT ⚠️
Background MUST be EXACTLY this color (for chroma key removal):
• Hex: ${bgColorHex}
• ${bgColorRGB}
• Color name: ${bgColorName}

${chromaKeyColor === 'magenta' 
  ? `MAGENTA COLOR GUIDE:
  ✅ CORRECT: Pure magenta ${bgColorHex} - R=255, G=0, B=255 (#FF00FF )
     (Imagine: Maximum red + Maximum blue + Zero green = Electric magenta)
  ❌ WRONG: Pink (#FF69B4), Purple (#800080), Hot Pink (#FF1493)
  ❌ WRONG: Any color with G > 50 is NOT magenta
  
  Visual Check: The background should look like a bright, electric magenta/fuchsia
  that hurts your eyes - NOT a soft pink or purple.`
  : `GREEN COLOR GUIDE:
  ✅ CORRECT: Standard green screen ${bgColorHex} - R=0, G=177, B=64 (#00B140)
     (Imagine: Zero red + High green + Low blue = Professional green screen)
  ❌ WRONG: Lime (#00FF00), Forest Green (#228B22), Neon Green (#39FF14)
  ❌ WRONG: Any color with R > 50 or B > 130 is NOT standard green screen
  
  Visual Check: The background should look like a professional video green screen
  used in film studios - NOT lime green or grass green.`}

DO NOT use any other shade or variant.
The background MUST be this EXACT color value ${bgColorHex}.
Think of it as a color picker set to EXACTLY ${bgColorRGB}.

══════════════════════════════════════════════════════════════
FRAME-BY-FRAME MICRO-MOVEMENTS
══════════════════════════════════════════════════════════════
${frameDescriptions}

Between ANY two consecutive frames:
• Limbs rotate by only ~${Math.max(3, Math.round(15 / totalFrames))}° to ${Math.max(5, Math.round(25 / totalFrames))}° MAX
• Body shifts by only ~${Math.max(1, Math.round(5 / totalFrames))}% to ${Math.max(2, Math.round(8 / totalFrames))}% of height MAX
• Head tilts by only ~${Math.max(1, Math.round(5 / totalFrames))}° to ${Math.max(2, Math.round(8 / totalFrames))}° MAX
• Facial expression: NO change or microscopic change only

THESE ARE MAXIMUM VALUES - smaller is better!

══════════════════════════════════════════════════════════════
VISUALIZATION: ONION SKIN TEST
══════════════════════════════════════════════════════════════
If you overlay Frame 1 and Frame 2 at 50% opacity each:
→ The character should appear as ONE slightly blurry figure
→ NOT as two clearly separate poses

If you overlay ALL ${totalFrames} frames:
→ Should look like ONE character with motion blur
→ NOT like ${totalFrames} different characters

══════════════════════════════════════════════════════════════
WHAT "SMALL MOTION" ACTUALLY MEANS
══════════════════════════════════════════════════════════════
For "${prompt}":

If the action involves arm movement:
- Total arm swing across ALL frames: ~30-60°
- Per frame: only ${Math.round(45 / totalFrames)}° change

If the action involves body bobbing:
- Total bob across ALL frames: ~5-15% of body height  
- Per frame: only ${Math.round(10 / totalFrames)}% change

If the action involves stepping:
- Total foot movement: ~10-20% of body width
- Per frame: only ${Math.round(15 / totalFrames)}% change

THINK: "Is this change small enough to be smooth at 12 FPS?"

══════════════════════════════════════════════════════════════
PERFECT LOOP CONNECTION
══════════════════════════════════════════════════════════════
Frame ${totalFrames} → Frame 1 must have the SAME tiny difference
as Frame 1 → Frame 2 or any other adjacent pair.

The animation is a CIRCLE, not a line.
Frame ${totalFrames} is NOT an "ending pose" - it flows INTO Frame 1.

══════════════════════════════════════════════════════════════
CHARACTER ANCHOR POINTS (CRITICAL)
══════════════════════════════════════════════════════════════
These must stay FIXED across all ${totalFrames} frames:
• Character's foot/ground contact point (same Y position)
• Overall character size (no zooming in/out)
• Character's center position in each grid cell
• Art style, colors, line thickness, proportions

══════════════════════════════════════════════════════════════
COMMON MISTAKES TO AVOID
══════════════════════════════════════════════════════════════
❌ WRONG: Frame 1 (standing) → Frame 2 (jumping high) = TOO MUCH CHANGE
✅ RIGHT: Frame 1 (knees slightly bent) → Frame 2 (knees bent 5° more)

❌ WRONG: Arms in completely different positions between frames
✅ RIGHT: Arms move only a few degrees between frames

❌ WRONG: Making each frame a "key pose" like concept art
✅ RIGHT: Making each frame a tiny increment, like video frames

❌ WRONG: Thinking "I need to show the full action range"
✅ RIGHT: Thinking "I need to show 1/${totalFrames}th of the action per frame"

══════════════════════════════════════════════════════════════
FINAL OUTPUT REQUIREMENTS
══════════════════════════════════════════════════════════════
• Single image containing ${cols}×${rows} grid of poses
• Background MUST be EXACTLY ${bgColorHex} (${bgColorRGB}) - NO OTHER COLOR
• All ${totalFrames} poses nearly identical with microscopic differences
• Smooth loop: Frame ${totalFrames} connects seamlessly to Frame 1
• NO text, numbers, labels, borders, or UI elements
• Character poses should be SEAMLESSLY placed on background

══════════════════════════════════════════════════════════════
ABSOLUTELY FORBIDDEN - CRITICAL - READ CAREFULLY
══════════════════════════════════════════════════════════════
• NO BORDERS OR FRAMES around individual poses or the entire image
• NO GRID LINES separating the poses - poses must blend into background
• NO BLACK LINES, WHITE LINES, or any colored lines between frames
• NO RECTANGLES or BOXES around each character pose
• NO ground line, floor line, or baseline under the character's feet
• NO shadow under the character
• NO platform or surface for the character to stand on  
• NO horizontal or vertical lines of any color anywhere
• NO color variations in background - ONLY EXACTLY ${bgColorHex}
• NO outlines around the sprite sheet or individual cells
• NO gradients - background must be perfectly flat solid ${bgColorHex}
• DO NOT use similar colors - ONLY the EXACT hex value ${bgColorHex}

⚠️ BACKGROUND COLOR IS CRITICAL FOR PROCESSING ⚠️
The background MUST be EXACTLY ${bgColorHex} (${bgColorRGB}).
Using any other shade will cause the chroma key removal to fail.

${chromaKeyColor === 'magenta' 
  ? `MAGENTA REQUIREMENT - MEMORIZE THIS:
  • R must be 255 (maximum)
  • G must be 0 (zero)
  • B must be 255 (maximum)
  • Result: ${bgColorHex} - Pure electric magenta
  • NOT pink (which has G > 100)
  • NOT purple (which has R < 200 or B < 200)`
  : `GREEN SCREEN REQUIREMENT - MEMORIZE THIS:
  • R must be 0 (zero)
  • G must be 177 (high but not maximum)
  • B must be 64 (low-medium)
  • Result: ${bgColorHex} - Professional green screen
  • NOT lime green (which has G = 255)
  • NOT neon green (which has R > 50 or B < 20)
  • NOT forest green (which has G < 150)`}

If you're unsure, imagine filling the background with a paint bucket tool
set to EXACTLY ${bgColorRGB}. Every background pixel should be this exact value.

⚠️ VERY IMPORTANT: Each character pose should be placed DIRECTLY on the
${bgColorHex} background with NO visible separation between grid cells.
The grid is CONCEPTUAL only - there should be NO visual indication of it.

The character should appear to FLOAT on the ${bgColorHex} background.
There should be NOTHING under the character's feet except ${bgColorHex}.
NO BORDERS. NO FRAMES. NO LINES. JUST CHARACTERS ON SOLID ${bgColorHex}.

Generate the sprite sheet with MINIMAL frame-to-frame variation.
`;
        
        if (onProgress) onProgress(`正在生成 ${cols}x${rows} 連貫動作精靈圖 (比例 ${targetAspectRatio})...`);
    }

    const response = await retryOperation(async () => {
        return await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
                    { text: fullPrompt }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: targetAspectRatio,
                    ...(outputResolution && { imageSize: outputResolution })
                }
            }
        });
    }, onProgress);

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
    throw new Error("API Key is missing. Please check settings.");
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
               onProgress(`等待 API 冷卻 (${Math.round(interFrameDelayMs/1000)}秒)... 準備繪製第 ${i + 1} 幀`);
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