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
Role: Professional Game Asset Artist specialized in 2D sprite animation.

⚠️ CRITICAL: This is a PURE SPRITE SHEET - ONLY character poses allowed.
NO text, NO numbers, NO lines, NO borders, NO boxes, NO frames, NO dividers, NO labels, NO decorative elements.
⚠️ ABSOLUTELY NO BORDER LINES (框線) - NO rectangular borders, NO cell borders, NO frame borders, NO outline borders.
Violation of this rule will result in unusable output.

🎯 MANDATORY GRID DIMENSIONS (NON-NEGOTIABLE - HIGHEST PRIORITY):

MATHEMATICAL REQUIREMENT:
You MUST create a grid with EXACTLY ${cols} COLUMNS (horizontal) and ${rows} ROWS (vertical).

Grid Structure:
┌─────────────────────────────────────┐
│ Column 1 │ Column 2 │ ... │ Column ${cols} │  ← Row 1 (${cols} poses)
├─────────────────────────────────────┤
│ Column 1 │ Column 2 │ ... │ Column ${cols} │  ← Row 2 (${cols} poses)
├─────────────────────────────────────┤
${rows > 2 ? `│ Column 1 │ Column 2 │ ... │ Column ${cols} │  ← Row 3 (${cols} poses)\n├─────────────────────────────────────┤\n` : ''}${rows > 3 ? `│ Column 1 │ Column 2 │ ... │ Column ${cols} │  ← Row 4 (${cols} poses)\n├─────────────────────────────────────┤\n` : ''}└─────────────────────────────────────┘

Grid Formula:
- Horizontal divisions: ${cols} columns
- Vertical divisions: ${rows} rows  
- Total cells: ${cols} × ${rows} = ${cols * rows} character poses
- Grid ratio: ${cols}:${rows} (width:height)

CRITICAL RULES:
1. EXACTLY ${cols} poses per row (count horizontally)
2. EXACTLY ${rows} rows total (count vertically)
3. EXACTLY ${cols * rows} total character poses
4. NO MORE than ${cols} columns - if you see ${cols + 1} or more, it's WRONG
5. NO LESS than ${cols} columns - if you see ${cols - 1} or fewer, it's WRONG
6. NO MORE than ${rows} rows - if you see ${rows + 1} or more, it's WRONG
7. NO LESS than ${rows} rows - if you see ${rows - 1} or fewer, it's WRONG
8. ⚠️ NO DUPLICATE ROWS / 禁止多列重複同一循環: Each row must show DIFFERENT poses. Do NOT repeat the same animation cycle across multiple rows. Every cell must be visually distinct (每格須不同) - no two cells may be identical or indistinguishable.

⚠️ VERIFICATION REQUIRED BEFORE OUTPUT:
Step 1: Count columns (left to right) - Must be EXACTLY ${cols}
Step 2: Count rows (top to bottom) - Must be EXACTLY ${rows}
Step 3: Multiply ${cols} × ${rows} - Must equal ${cols * rows} total poses

If ANY count is wrong, DO NOT OUTPUT. Regenerate with correct dimensions.

Task:
Create a single 2D sprite sheet image of a character performing:
"${prompt}"

The result must be ONE continuous image containing
EXACTLY ${cols * rows} animation poses arranged in a grid of
${cols} columns (horizontal) × ${rows} rows (vertical).

OUTPUT REQUIREMENTS:
- Pure character animation poses ONLY
- Solid magenta (#FF00FF) background
- ⚠️ ABSOLUTELY NO BORDER LINES (框線) of any kind
- NO rectangular borders around cells or frames
- NO outline borders around characters
- NO bottom border lines
- NO frame numbers (1, 2, 3, etc.)
- NO text, labels, or annotations
- NO grid lines or separators
- NO decorative elements
- NO boxes, NO frames, NO panels

CRITICAL REQUIREMENT - SEAMLESS ANIMATION:
Each frame must flow PERFECTLY into the next frame, creating a smooth,
continuous animation loop. The character should appear to move naturally
from one pose to the next with no visual breaks, jumps, or inconsistencies.
Think of this as capturing a single continuous motion, not separate static poses.

ABSOLUTE RULES (MUST FOLLOW - VIOLATION WILL RESULT IN REJECTION):

FORBIDDEN ELEMENTS (NEVER DRAW THESE):
- NO text of any kind (numbers, letters, words, labels, captions).
- NO frame numbers (1, 2, 3, etc.) or sequence indicators.
- ⚠️ ABSOLUTELY NO BORDER LINES (框線) - This is the MOST CRITICAL rule:
  * NO rectangular borders around individual cells
  * NO rectangular borders around the entire grid
  * NO outline borders around characters
  * NO frame borders, NO cell borders, NO box borders
  * NO borders of any shape, size, or color
  * NO borders even if they are the same color as background
  * NO borders even if they are transparent or semi-transparent
- NO borders, lines, boxes, panels, dividers, or separators of any kind.
- NO bottom border lines, base lines, ground lines, floor lines, or horizontal dividers.
- ⚠️ CRITICAL: NO floor line (直線地板) beneath character feet - characters float on transparent/background only.
- NO ground indicator lines, base reference lines, or horizontal reference lines.
- NO grid lines, cell boundaries, or section markers.
- NO UI elements, watermarks, symbols, or decorative elements.
- NO visual indicators of rows, columns, grids, or sections.
- NO frame labels, position markers, or coordinate indicators.

CANVAS REQUIREMENTS:
- The canvas must appear as ONE uninterrupted transparent space.
- Only the character poses should be visible - nothing else.
- No structural elements, no organizational markers, no reference lines.

BACKGROUND:

- Use a single, flat, solid chroma key background color.
- Background color: pure magenta (#FF00FF).
- No gradients, no texture, no pattern.
- The background must be a single uniform color across the entire canvas.

CANVAS ASPECT RATIO:
- The canvas aspect ratio is set to ${targetAspectRatio} to match the grid layout.
- This aspect ratio is calculated specifically for ${cols} columns × ${rows} rows grid.
- Grid ratio: ${cols}:${rows} (columns:rows) = ${(cols/rows).toFixed(3)}:1
- The canvas dimensions will be automatically adjusted to maintain this ratio.
- Ensure the grid fills the entire canvas evenly with EXACTLY ${cols} columns and ${rows} rows.

LAYOUT & PLACEMENT (CRITICAL - GRID DIMENSIONS ARE MANDATORY):

⚠️ GRID STRUCTURE (MUST BE EXACT):
- The canvas must be divided into a grid of EXACTLY ${cols} columns × ${rows} rows.
- This creates ${cols * rows} equal-sized cells.
- Each cell contains exactly ONE character pose.
- NO MORE THAN ${cols} columns, NO MORE THAN ${rows} rows.
- NO FEWER THAN ${cols} columns, NO FEWER THAN ${rows} rows.

Grid Calculation:
- Horizontal division: ${cols} equal columns
- Vertical division: ${rows} equal rows
- Total cells: ${cols} × ${rows} = ${cols * rows}

Placement Rules:
- The canvas has no padding or margins.
- Characters are evenly spaced in fixed positions.
- Row 1: ${cols} poses (left to right)
- Row 2: ${cols} poses (left to right)
${rows > 2 ? `- Row 3: ${cols} poses (left to right)\n${rows > 3 ? `- Row 4: ${cols} poses (left to right)\n` : ''}` : ''}
- Place exactly one character pose at each grid cell.
- All poses must be perfectly centered within their grid cell.
- The grid must be perfectly uniform - all cells the same size.

CONSISTENCY RULES:

- Character size must be identical in every pose.
- No scaling, no zooming, no rotation drift.
- Feet must align to the same horizontal position across all frames
  (approximately 85% of the canvas height per row).
- ⚠️ IMPORTANT: Characters should appear to stand on an invisible ground plane.
  DO NOT draw any visible floor line, ground line, or base line.
  The character's feet should simply align horizontally without any visible line beneath them.

CONTAINMENT (ANTI-OVERLAP):

- Each pose must remain within an invisible safe area.
- Maximum movement and limb extension must stay inside this safe area.
- No part of the character may overlap another pose.

ANIMATION FLOW & CONTINUITY (CRITICAL):

- Order reads left to right, then top to bottom.
- Motion must be PERFECTLY SMOOTH and SEAMLESSLY CONTINUOUS.
- Each frame must logically flow into the next with no visual gaps or jumps.

Frame-to-Frame Continuity (MANDATORY):
- Each pose must be a natural progression from the previous pose.
- Body parts must move in predictable, physics-based trajectories.
- Calculate intermediate positions: if arm is at position A in frame 1 and position C in frame 3, 
  frame 2 must show the arm at position B (midpoint).
- NO sudden position changes, NO teleporting, NO disappearing/reappearing body parts.

Motion Arc & Easing:
- All limb movements follow smooth arcs (not straight lines).
- Use natural easing: movements start slow, accelerate in the middle, slow down at the end.
- Anticipation: before major movements, show slight backward motion (wind-up).
- Follow-through: after major movements, show slight overshoot and settle.
- Secondary motion: hair, clothing, accessories lag slightly behind primary motion.

Temporal Consistency:
- Maintain consistent timing: if frame 1-2 shows a fast movement, frame 2-3 should continue that pace.
- Avoid inconsistent pacing: don't mix slow and fast movements randomly.
- For cyclic animations (run, walk, idle), ensure the last frame seamlessly loops to the first frame.

Spatial Consistency:
- Keep feet anchored to the same horizontal position across ALL frames (approximately 85% of canvas height per row).
- ⚠️ NO visible ground line or floor line - feet alignment is invisible, not drawn.
- Maintain consistent character size: measure from head to feet, keep identical across all frames.
- Center of gravity should move in smooth curves, not jump between positions.
- Avoid vertical or horizontal drift: character should stay in the same relative position.

Progressive Motion Breakdown:
- Frame 1 → Frame 2: Show 25% of total movement
- Frame 2 → Frame 3: Show next 25% of movement
- Continue this progressive breakdown for all frames
- Each frame should feel like a natural "in-between" of the previous and next frames

Body Part Coordination:
- When one limb moves forward, the opposite limb typically moves backward (walking/running).
- Head should bob naturally with body movement (subtle, not exaggerated).
- Torso rotation should be gradual and match limb movement.
- Maintain natural weight distribution: character should never appear off-balance.

Loop Seamlessness (for cyclic actions):
- The last frame must visually connect to the first frame.
- If the action is a cycle (run, walk, idle), ensure the final pose can naturally transition back to the first pose.
- Position, pose, and momentum should create a perfect loop.
- ⚠️ EVEN FOR CYCLES: Do NOT copy the same cycle to fill multiple rows. If the grid has multiple rows, each row must be a different phase or variation of the motion - never identical to another row (禁止多列重複同一循環). Every cell must be a unique pose (每格須不同).

STYLE:

- Flat 2D illustration.
- Clean, sharp outlines.
- Even neutral lighting.
- No shadows, no depth effects.

FAIL-SAFE PRIORITY:

1. FIRST PRIORITY: No forbidden elements (text, numbers, lines, borders).
2. SECOND PRIORITY: Clean layout and proper containment.
3. THIRD PRIORITY: Alignment and spacing consistency.

If any artistic choice conflicts with these priorities,
ALWAYS prioritize removing forbidden elements first.
A clean sprite sheet with perfect poses is better than
a sprite sheet with correct poses but unwanted elements.

FINAL CHECKLIST BEFORE OUTPUT:
✓ Grid dimensions: EXACTLY ${cols} columns × ${rows} rows (verify by counting!)
✓ Total frames: EXACTLY ${cols * rows} character poses
✓ ⚠️ NO duplicate rows (禁止多列重複同一循環) - each row has DIFFERENT poses, each cell unique (每格須不同)
✓ ⚠️ NO BORDER LINES (框線) - Check for rectangular borders around cells or grid
✓ ⚠️ NO BORDER LINES - Check for outline borders around characters
✓ ⚠️ NO BORDER LINES - Check for any rectangular shapes or frames
✓ No text or numbers anywhere
✓ No lines or borders anywhere
✓ No bottom border lines or base lines
✓ No frame numbers or labels
✓ Only character poses visible
✓ Solid magenta background only
✓ Clean, uninterrupted canvas

NEGATIVE PROMPT (STRICTLY FORBIDDEN):

VISUAL STRUCTURE (FORBIDDEN):
框線, border line, border, rectangular border, cell border, frame border, outline border,
box border, square border, rectangle border, border frame, border box,
grid, grid lines, frame lines, border lines, bottom border, base line, ground line,
floor line, 直線地板, ground indicator, floor indicator, base reference line,
horizontal line, vertical line, divider line, separator line,
panel, box, tile, cell boundary, section marker, rectangular frame,
frame number, frame label, position number, sequence number,
text, numbers, letters, digits, labels, captions, annotations,
watermark, signature, copyright, UI element, HUD element,
comic layout, storyboard, reference line, guide line,
checkerboard, transparency pattern, alpha grid, background pattern,
line beneath feet, line under character, ground mark, floor mark,
rectangular outline, cell outline, frame outline, border rectangle

DECORATIVE ELEMENTS (FORBIDDEN):
white outline, white halo, fringe, border decoration,
shadow, glow, vignette, frame decoration,
background color variation, off-white, gradient background

ANIMATION ERRORS (FORBIDDEN):
motion blur, jitter, scaling inconsistency,
discontinuous motion, teleporting, position jump,
abrupt movement, sudden change, frame gap,
inconsistent timing, erratic pacing,
body part disappearing, limb teleportation,
character drift, size variation, scale jump,
duplicate rows, repeating the same cycle across multiple rows, identical cells, 多列重複同一循環, 每格相同

CRITICAL REMINDER:
The output must be PURE CHARACTER POSES ONLY.
No lines, no numbers, no borders, no labels, no structural elements.
Just the character animation frames on a solid magenta background.

⚠️ FINAL VERIFICATION BEFORE GENERATING:
Before you output the image, mentally scan it and verify:

GRID DIMENSION CHECK (MOST CRITICAL):
0. Count the columns: Is it EXACTLY ${cols}? → If NO, DO NOT OUTPUT, regenerate with ${cols} columns
1. Count the rows: Is it EXACTLY ${rows}? → If NO, DO NOT OUTPUT, regenerate with ${rows} rows
2. Total count: Are there EXACTLY ${cols * rows} character poses? → If NO, DO NOT OUTPUT

BORDER LINE CHECK (CRITICAL - CHECK THIS FIRST):
3. ⚠️ Can you see ANY rectangular borders (框線) around cells? → REMOVE THEM IMMEDIATELY
4. ⚠️ Can you see ANY rectangular borders around the grid? → REMOVE THEM IMMEDIATELY
5. ⚠️ Can you see ANY outline borders around characters? → REMOVE THEM IMMEDIATELY
6. ⚠️ Can you see ANY boxes, frames, or rectangular shapes? → REMOVE THEM IMMEDIATELY
7. ⚠️ Are there ANY lines forming rectangles or squares? → REMOVE THEM IMMEDIATELY

CONTENT CHECK:
8. Can you see ANY numbers? → REMOVE THEM
9. Can you see ANY lines (especially bottom borders, floor lines, ground lines)? → REMOVE THEM
10. Can you see ANY floor line (直線地板) beneath character feet? → REMOVE IT IMMEDIATELY
11. Can you see ANY text or labels? → REMOVE THEM
12. Is the background pure magenta with NO decorative elements? → YES, KEEP IT CLEAN
13. Are ONLY character poses visible (no lines, no numbers, no borders, no boxes)? → YES, PERFECT

If you see ANY border lines (框線), DO NOT OUTPUT THE IMAGE - regenerate without borders.
If the grid dimensions are wrong (not ${cols}×${rows}), DO NOT OUTPUT THE IMAGE.
If you see ANY forbidden elements, DO NOT OUTPUT THE IMAGE.
Generate again with the CORRECT dimensions and WITHOUT any borders or forbidden elements.

Remember: A sprite sheet is a technical asset, not an illustration.
It must be clean, pure, and contain ONLY the character animation frames.
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