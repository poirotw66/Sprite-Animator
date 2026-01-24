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
 * Calculates the best supported aspect ratio for the given grid cols/rows.
 * Supported by Gemini: "1:1", "3:4", "4:3", "9:16", "16:9".
 */
function getBestAspectRatio(cols: number, rows: number): string {
    const ratio = cols / rows;
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
 * NOTE: We deliberately use a text-optimized model here to save quota on the image model
 * and to avoid hitting the RPM limit of the image model before we even start drawing.
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
    
    const fullPrompt = `
    Reference Image: A game character.
    Task: Generate a 2D Sprite Sheet.
    
    Action: "${prompt}"
    Layout: A grid with EXACTLY ${cols} columns and ${rows} rows.
    Total Frames: ${cols * rows}.
    
    CRITICAL LAYOUT INSTRUCTIONS:
    1. The output image MUST contain exactly ${cols * rows} distinct character poses.
    2. DO NOT generate a 3x3 grid if I asked for ${cols}x${rows}.
    3. The character must be centered in each of the ${cols * rows} imaginary grid cells.
    4. Maintain equal spacing between sprites.
    5. Sequence: Top-left to bottom-right order.
    
    Requirements:
    - Background: Solid WHITE (hex #FFFFFF).
    - Character Style: Consistent with reference. Flat 2D.
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
  // We use a separate logic for storyboard to avoid rate limiting the main image model
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
            model: model, // This uses the Image model (e.g., gemini-2.5-flash-image)
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
  
  // Initial delay before starting the heavy image generation loop
  // Even though we used a text model for storyboard, we add a pause to be safe.
  if (onProgress) onProgress("分鏡規劃完成，準備繪製...");
  await wait(2000);

  for (let i = 0; i < frameDescriptions.length; i++) {
      const desc = frameDescriptions[i];
      try {
        if (onProgress) onProgress(`正在繪製第 ${i + 1} / ${frameDescriptions.length} 幀...`);

        // Add delay BEFORE the request (except the first one)
        if (i > 0) {
            if (onProgress && interFrameDelayMs > 1000) {
               onProgress(`等待 API 冷卻 (${Math.round(interFrameDelayMs/1000)}秒)... 準備繪製第 ${i + 1} 幀`);
            }
            await wait(interFrameDelayMs); 
            
            // Re-update status after waiting
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