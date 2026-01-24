import { GoogleGenAI } from "@google/genai";

export type ProgressCallback = (status: string) => void;

// Helper for delay
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to check if error is related to quota
const isQuotaError = (error: any): boolean => {
    const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return (
        error.status === 429 || 
        error.code === 429 || 
        msg.includes('429') || 
        msg.includes('Quota') || 
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota') ||
        msg.includes('exceeded')
    );
};

// Helper for retrying operations with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>, 
  onStatusUpdate?: (msg: string) => void,
  retries = 5, // Increased retries to handle stricter limits
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
        
        console.warn(`Rate limit hit (Attempt ${i + 1}/${retries}). Retrying in ${waitSeconds}s...`);
        if (onStatusUpdate) {
          onStatusUpdate(`API 繁忙 (429)，等待 ${waitSeconds} 秒後重試... (嘗試 ${i + 1}/${retries})`);
        }
        
        await wait(delay);
        continue;
      }
      
      // If it's not a recoverable error (or not quota), throw immediately
      throw error;
    }
  }
  throw lastError;
}

/**
 * Determines the optimal Aspect Ratio for a given grid configuration.
 * This ensures individual cells are roughly square or portrait, preventing squashed sprites.
 */
function getBestAspectRatio(cols: number, rows: number): string {
    const ratio = cols / rows;
    
    // Explicit overrides for common configurations to ensure best "Cell Shape"
    // We want cells to be square (1:1) or slightly tall for characters.
    const key = `${cols}x${rows}`;
    const overrides: Record<string, string> = {
        "2x1": "16:9", // Wide strip
        "3x1": "16:9",
        "4x1": "16:9", 
        "2x2": "1:1",  // Perfect square
        "3x2": "4:3",  // 1.5 ratio -> 1.33 (Cells slightly tall)
        "4x2": "16:9", // 2.0 ratio -> 1.77 (Cells slightly tall)
        "5x2": "16:9", 
        "3x3": "1:1",  // Perfect square
        "4x3": "4:3",  // 1.33 ratio -> 1.33 (Perfect)
        "1x4": "9:16", // Tall strip
    };

    if (overrides[key]) {
        return overrides[key];
    }

    // Fallback logic for unusual grids
    const targets = [
        { str: "1:1", val: 1.0 },
        { str: "3:4", val: 0.75 }, 
        { str: "4:3", val: 1.33 }, 
        { str: "9:16", val: 0.5625 }, 
        { str: "16:9", val: 1.77 }, 
    ];
    // Find closest ratio
    return targets.reduce((prev, curr) => 
        Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
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
    
    // 2. Construct a prompt that enforces specific geometry
    const fullPrompt = `
    Reference Image: A game character.
    Task: Generate a 2D Sprite Sheet.
    
    Action: "${prompt}"
    
    [STRICT GRID CONFIGURATION]
    - Columns: ${cols}
    - Rows: ${rows}
    - Total Sprites: ${cols * rows}
    
    [GEOMETRY RULES]
    1. The output image aspect ratio is set to ${targetAspectRatio}.
    2. Divide this space into a perfect ${cols}x${rows} grid.
    3. Center EXACTLY ONE character pose in the middle of each grid cell.
    4. Ensure equal spacing and margins around every character so they can be sliced programmatically.
    5. Order: Top-left to bottom-right.
    6. DO NOT add any outer borders or frames to the image. Background must be solid white.
    7. DO NOT change the grid count. If I ask for ${cols}x${rows}, do not give me 3x3.
    
    Style: Consistent with reference. Flat 2D.
    `;

    if (onProgress) onProgress(`正在生成 ${cols}x${rows} 精靈圖 (比例 ${targetAspectRatio})...`);

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

  // Define single frame generator function
  const generateFrame = async (frameDesc: string, i: number) => {
    const fullPrompt = `
    Reference Image: A game character.
    Task: Generate Frame ${i + 1} of ${frameCount} for a sprite sheet.
    
    Action: "${prompt}".
    Pose Description: ${frameDesc}.
    
    Style: Keep EXACT character design, colors, and white background. Flat 2D style.
    `;

    const response = await retryOperation(async () => {
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

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error(`No image data received for frame ${i + 1}`);
  };

  // Step 2: Generate Frames Serially
  const results: string[] = [];
  
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
            
            if (onProgress) onProgress(`正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`);
        }
        
        const frameResult = await generateFrame(desc, i);
        results.push(frameResult);

      } catch (error: any) {
        console.error(`Generation failed at frame ${i + 1}`, error);
        throw error;
      }
  }

  return results;
};