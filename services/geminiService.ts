import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper to get a storyboard plan from Gemini.
 * This ensures the frames follow a logical physical sequence (squash and stretch, anticipation, etc.)
 */
async function getAnimationStoryboard(
  ai: GoogleGenAI, 
  model: string, 
  imageBase64: string, 
  userPrompt: string, 
  frameCount: number
): Promise<string[]> {
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const systemPrompt = `You are a professional 2D Frame-by-Frame Animator. 
  Your task is to breakdown a user's requested action into exactly ${frameCount} sequential keyframes for a game sprite.
  
  The action is: "${userPrompt}".
  
  Rules:
  1. Analyze the provided character image.
  2. Create a sequence that loops smoothly if possible.
  3. Apply animation principles like "Anticipation", "Squash and Stretch", and "Follow Through".
  4. Return ONLY a JSON array of strings, where each string is a visual description of that frame's pose.
  5. The description must focus on the pose, limbs, and motion.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: systemPrompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        },
        temperature: 1 // High creativity for motion planning
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty storyboard response");
    
    const storyboard = JSON.parse(jsonText) as string[];
    
    // Safety check: Ensure we have exactly the right number of frames
    if (storyboard.length > frameCount) return storyboard.slice(0, frameCount);
    if (storyboard.length < frameCount) {
        // Pad with the last frame description if short
        while(storyboard.length < frameCount) {
            storyboard.push(storyboard[storyboard.length - 1]);
        }
    }
    return storyboard;

  } catch (e) {
    console.warn("Storyboard generation failed, falling back to algorithmic descriptions.", e);
    // Fallback if JSON parsing fails or model refuses
    return Array.from({ length: frameCount }, (_, i) => {
        const progress = i / (frameCount - 1 || 1);
        if (progress < 0.2) return `Preparation/Anticipation phase of ${userPrompt}`;
        if (progress < 0.8) return `Main action/Climax phase of ${userPrompt}`;
        return `Recovery/Follow-through phase of ${userPrompt}`;
    });
  }
}

/**
 * Generates animation frames using Gemini.
 * Uses a two-step process: Plan (Storyboard) -> Draw (Generate).
 */
export const generateAnimationFrames = async (
  imageBase64: string,
  prompt: string,
  frameCount: number,
  apiKey: string,
  model: string
): Promise<string[]> => {
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please check settings.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  // Step 1: Generate the Storyboard (The Plan)
  // This helps make the frames feel "connected" rather than random.
  const frameDescriptions = await getAnimationStoryboard(ai, model, imageBase64, prompt, frameCount);

  // Define single frame generator function
  const generateFrame = async (frameDesc: string, i: number) => {
    // Refined prompt to enforce consistency
    const fullPrompt = `
    Reference Image: A game character.
    Task: Generate Frame ${i + 1} of a ${frameCount}-frame sprite animation.
    
    Action Context: The character is performing "${prompt}".
    Current Frame Pose Description: ${frameDesc}.
    
    CRITICAL STYLE INSTRUCTIONS:
    - KEEP THE EXACT SAME CHARACTER DESIGN, COLORS, AND PROPORTIONS as the reference image.
    - White background.
    - Full body shot.
    - This is a 2D asset, keep the shading flat or consistent with the reference.
    `;

    const response = await ai.models.generateContent({
      model: model, 
      contents: {
        parts: [
            { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
            { text: fullPrompt }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error(`No image data for frame ${i + 1}`);
  };

  // Step 2: Generate Frames in batches (parallel with limit)
  const results: string[] = [];
  const BATCH_SIZE = 4; // Generate 4 frames at a time to be safe

  for (let i = 0; i < frameDescriptions.length; i += BATCH_SIZE) {
      const batch = frameDescriptions.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((desc, idx) => generateFrame(desc, i + idx));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error: any) {
        console.error(`Batch generation failed at index ${i}`, error);
        throw error;
      }
  }

  return results;
};