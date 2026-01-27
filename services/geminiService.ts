import { GoogleGenAI } from "@google/genai";
import { isQuotaError as checkQuotaError, getErrorMessage, type ApiError } from '../types/errors';
import { logger } from '../utils/logger';

export type ProgressCallback = (status: string) => void;

// Helper for delay
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    onProgress?: ProgressCallback
): Promise<string> => {
    if (!apiKey) throw new Error("API Key is missing");

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    // 1. Determine best aspect ratio config to force correct layout
    const targetAspectRatio = getBestAspectRatio(cols, rows);
    
    // 2. Construct a prompt that enforces specific geometry AND animation continuity
    const fullPrompt = `
Role: Professional 2D game sprite artist.

Task:
Create ONE single 2D sprite sheet image showing:
"${prompt}"

LAYOUT (HIGHEST PRIORITY):
- Arrange EXACTLY ${cols * rows} character poses
- Layout forms ${cols} poses per row and ${rows} rows total
- Evenly spaced, fixed positions
- Read order: left → right, top → bottom
- One unique character pose per cell
- NO duplicated poses, NO repeated rows

CANVAS & BACKGROUND:
- One continuous canvas (no padding, no margins)
- Solid background color: pure magenta (#FF00FF)
- No gradients, no texture

STRICTLY FORBIDDEN (MOST CRITICAL):
- NO text, NO numbers
- NO lines of any kind
- NO borders / frames / boxes / grids
- NO cell outlines, NO rectangular shapes
- NO ground line / floor line under feet
- NO UI elements or decorations
- NO alignment guides, NO helper lines, NO separators, even faint or subtle
- Background must be ONE continuous flat color with no seams or divisions


SPRITE REQUIREMENTS:
- Flat 2D illustration
- Clean outlines, no shadows or glow
- Character size identical in every frame
- Character centered in each grid cell
- Feet aligned horizontally across all frames
- No scaling, no rotation drift, no position jump

ANIMATION QUALITY (FOR GIF USE):
- Frames must form ONE continuous, smooth motion
- Each frame is a natural in-between (no teleporting)
- Smooth arcs, easing, anticipation, follow-through
- Limbs move progressively and consistently
- Last frame must loop seamlessly to first frame
- All frames are unique poses

IMPORTANT:
This is a technical sprite sheet asset.
Output must contain ONLY character animation poses on magenta background.
If grid size or forbidden elements are wrong, the result is unusable.

negative prompt:
text, numbers, letters,
border, frame, box, grid, outline,
cell edge, cell boundary, separator,
alignment line, guide line,
faint line, thin line, seam,
ground line, floor line, baseline,
panel, UI, watermark,
shadow, glow, gradient,
duplicate frame, repeated pose

    `;

    if (onProgress) onProgress(`正在生成 ${cols}x${rows} 連貫動作精靈圖 (比例 ${targetAspectRatio})...`);

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
                    aspectRatio: targetAspectRatio
                }
            }
        });
    }, onProgress);

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
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