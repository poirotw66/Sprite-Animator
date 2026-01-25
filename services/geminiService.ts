import { GoogleGenAI } from "@google/genai";

export type ProgressCallback = (status: string) => void;

// Helper for delay
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to check if error is related to quota or overloading
const isQuotaError = (error: any): boolean => {
    const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return (
        error.status === 429 || 
        error.code === 429 || 
        error.status === 503 || 
        error.code === 503 ||
        msg.includes('429') || 
        msg.includes('503') ||
        msg.includes('Quota') || 
        msg.includes('RESOURCE_EXHAUSTED') || 
        msg.includes('quota') ||
        msg.includes('exceeded') ||
        msg.includes('Overloaded')
    );
};

// Helper for retrying operations with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>, 
  onStatusUpdate?: (msg: string) => void,
  retries = 5, 
  baseDelay = 4000 
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (isQuotaError(error) && i < retries - 1) {
        // Backoff: 4s, 8s, 16s... covering the 3.6s window from the start
        const delay = baseDelay * Math.pow(2, i) + (Math.random() * 1000); 
        const waitSeconds = Math.round(delay / 1000);
        
        console.warn(`Rate limit/Overload hit (Attempt ${i + 1}/${retries}). Retrying in ${waitSeconds}s...`);
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
 * Helper to get a storyboard plan from Gemini.
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

  } catch (e: any) {
    if (isQuotaError(e)) {
        console.error("Quota exceeded during storyboard generation. Aborting.");
        throw e;
    }

    console.warn("Storyboard generation failed (non-quota error), falling back to algorithmic descriptions.", e);
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
 * Generates a single Sprite Sheet image.
 * This is much more quota-efficient (1 request).
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
    Role: Professional Game Asset Artist.
    Task: Create a cohesive 2D Sprite Sheet from the reference character.
    
    [INPUT SPECIFICATIONS]
    - Action: "${prompt}"
    - Grid Layout: ${cols} Columns x ${rows} Rows.
    - Total Frames: ${cols * rows}.

    [CRITICAL RESTRICTIONS - MUST FOLLOW]
    1. **NO TEXT / NO NUMBERS**: Do NOT write frame numbers (1, 2, 3...), labels, or annotations anywhere on the image.
    2. **NO BORDERS / NO GRID LINES**: Do NOT draw visible lines separating the cells. Do NOT draw a frame around the image. The background must be continuous.
    3. **SOLID BACKGROUND**: Use a pure, solid white (#FFFFFF) background only.
    4. **NO VIGNETTING / NO SHADOWS**: The image corners (especially top-left) MUST be pure white (#FFFFFF). Eliminate all lighting falloff or dark artifacts at the edges.
    
    [STRICT GRID LAYOUT]
    1. **Edge-to-Edge Grid**: The output image must be a PERFECT GRID with NO outer padding.
    2. **Invisible Grid**: Programmatically, I will slice this image by dividing the total Width by ${cols} and Height by ${rows}. 
    3. **Centering**: Place exactly one character pose in the visual center of each calculated cell. Do NOT offset them.

    [ANIMATION RULES]
    1. **Sequence**: Animation reads Left-to-Right, Top-to-Bottom. Start at the Top-Left cell.
    2. **Consistency**: The character size (head to toe) must be identical in every frame. 
    3. **Grounding**: Ensure the character's feet touch the same imaginary ground line within every cell. This prevents "jittering" when the animation plays.
    4. **Looping**: If the action implies a cycle, make the last frame connect smoothly to the first.

    [VISUAL STYLE]
    - Flat 2D style.
    - **Lighting**: Flat, even studio lighting. Absolutely NO dark corners or vignettes.
    - Solid Pure White Background (#FFFFFF) extending to all edges.
    
    [ASPECT RATIO TARGET]
    The requested aspect ratio is ${targetAspectRatio}. Distribute the ${cols}x${rows} frames evenly to fill this shape completely.
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
 * Generates animation frames using Gemini (Frame-by-Frame mode).
 * Optimized for continuity by passing the previous frame as context.
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
    const parts: any[] = [];
    
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

      } catch (error: any) {
        console.error(`Generation failed at frame ${i + 1}`, error);
        throw error;
      }
  }

  return results;
};