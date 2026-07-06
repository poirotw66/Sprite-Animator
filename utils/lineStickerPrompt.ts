/**
 * LINE Sticker Prompt Structure
 * 
 * This file implements a modular prompt system with slots:
 * - Base: Core requirements that never change
 * - Style Slot: Art style and visual approach
 * - Character Slot: Reference-image rules only (style from uploaded image + grid)
 * - Theme Slot: Chat context and use cases
 * - Text Slot: Language and text content
 */

import { clampStickerPhrase } from './lineStickerPhraseLength';
import { getLineStickerCanvasAspectPrompt } from './lineStickerSheetAspect';
import {
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    FONT_PRESET_ORDER,
    FONT_PRESET_CANVAS_ORDER,
    DEFAULT_THEME_SLOT,
    DEFAULT_TEXT_SLOT,
    THEME_PRESETS,
    STYLE_PRESETS,
    STYLE_PRESET_ORDER,
    CHARACTER_PRESETS,
    DEFAULT_CHARACTER_SLOT,
    TEXT_PRESETS,
} from './lineStickerPresets';
import type {
    LineStickerFontKey,
    ThemeOption,
    LineStickerStyleOption,
} from './lineStickerPresets';

// Re-export presets so existing importers of './lineStickerPrompt' keep working.
export {
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    FONT_PRESET_ORDER,
    FONT_PRESET_CANVAS_ORDER,
    DEFAULT_THEME_SLOT,
    DEFAULT_TEXT_SLOT,
    THEME_PRESETS,
    STYLE_PRESETS,
    STYLE_PRESET_ORDER,
    CHARACTER_PRESETS,
    DEFAULT_CHARACTER_SLOT,
    TEXT_PRESETS,
};
export type { LineStickerFontKey, ThemeOption, LineStickerStyleOption };

export interface PromptSlots {
    style: StyleSlot;
    character: CharacterSlot;
    theme: ThemeSlot;
    text: TextSlot;
}

export type LineStickerPromptVersion = 'v1' | 'v2' | 'v3' | 'v3compact';

/** How sticker phrase text appears: drawn by the image model, or composited in the browser after slicing. */
export type LineStickerTextRendering = 'model' | 'programmatic';

/** Value passed to Gemini / prompt builders so the model omits text when we overlay it in code. */
export function getEffectiveLineStickerIncludeText(
    includeText: boolean,
    textRendering: LineStickerTextRendering
): boolean {
    return textRendering === 'model' ? includeText : false;
}

export interface StyleSlot {
    styleType: string;
    drawingMethod: string;
    /** Omitted in prompt: background is always the chroma key (e.g. Pure Magenta) for sprite-sheet cutting. */
    background?: string;
    /** When 'style', outline color follows the style (e.g. dark brown, black); otherwise use white stroke for LINE readability. */
    outlinePreference?: 'white' | 'style';
    /** When 'soft', allow gentle shading/wash for paint-like styles; default 'flat' keeps strict flat shading for chroma key. */
    lightingPreference?: 'flat' | 'soft';
}

export interface CharacterSlot {
    /** Rules for drawing from the reference image; style is determined by the uploaded image and sticker grid only. */
    originalImageRules: string;
}

export interface ThemeSlot {
    chatContext: string;
    examplePhrases: string[];
    specialStickers?: {
        description: string;
        texts: string[];
    };
}

/** Example phrases plus optional special sticker texts; order matches prompt cycling. */
export function collectThemePhraseCycle(theme: Pick<ThemeSlot, 'examplePhrases' | 'specialStickers'>): string[] {
    const extra = theme.specialStickers?.texts ?? [];
    return [...theme.examplePhrases, ...extra];
}

/** Fill exactly totalFrames entries by cycling theme phrases (same rule as grid prompt cells). */
export function expandThemePhrasesForFrames(
    theme: Pick<ThemeSlot, 'examplePhrases' | 'specialStickers'>,
    totalFrames: number,
    language: string = 'Traditional Chinese'
): string[] {
    const cycle = collectThemePhraseCycle(theme);
    if (cycle.length === 0) {
        return Array.from({ length: totalFrames }, (_, index) => `Expression ${index + 1}`);
    }
    return Array.from({ length: totalFrames }, (_, index) =>
        clampStickerPhrase(cycle[index % cycle.length] ?? '', language)
    );
}

export interface TextSlot {
    language: string;
    textStyle: string;
    textColor: string;
    lengthConstraints: {
        chinese: string;
        english: string;
    };
}

/** Resolve font style text for image-generation prompts (model-drawn sticker text). */
export function resolveFontStylePromptDesc(
    fontKey: LineStickerFontKey,
    customFontText: string
): string {
    if (fontKey === 'custom') {
        const trimmed = customFontText.trim();
        if (!trimmed) {
            return 'Custom sticker font style (user did not specify). Use a clear readable font with thick outline and high contrast for tiny chat stickers.';
        }
        return `${trimmed}. Render as sticker text with thick outline, high contrast, and legibility at small chat preview size.`;
    }
    return FONT_PRESETS[fontKey].promptDesc;
}

// Global-to-local order: Layout → Style → Subject → Lighting/Background → Per-cell → Text → Final
export const BASE_PROMPT = `🎨 LINE Sticker Sprite Sheet Generation

### [1. Global Layout] CRITICAL

* **Canvas**: {CANVAS_ASPECT}. High resolution output.
* **Grid**: {COLS}×{ROWS} = {TOTAL_FRAMES} cells. Each cell exactly **{CELL_WIDTH_PCT}% of image width** and **{CELL_HEIGHT_PCT}% of image height**.
* **Margins**: None. Image edges = grid boundaries. No empty space at left, right, top, or bottom.
* **NO VISIBLE DIVIDERS — ABSOLUTE, NON-NEGOTIABLE**: You MUST NOT draw ANY of the following anywhere on the image: grid lines, frame lines, borders, dividers, separator lines, cell outlines, boxes around or between cells, white lines, white strips, white borders, or any visible line of any color between or around cells. The grid is LOGICAL ONLY (for splitting later). Where one cell meets the next, both sides MUST be the EXACT SAME background color with ZERO visible gap, rule, or edge. The boundary between any two cells must be COMPLETELY INVISIBLE. One continuous background only—no lines of any kind. Drawing any visible line between cells makes the output invalid.
* **Output**: The image MUST be perfectly splittable into {TOTAL_FRAMES} equal rectangles.
* **Per cell**: Subject(s) from the reference {AND_TEXT} must occupy ~70–85% of cell height. Minimum internal padding ~5–10%. Subject(s) must stay within the cell and not touch adjacent cells. One independent sticker per cell. {AND_CLOSE_TEXT}
`;

// When includeText: enforce separate Character Zone vs Text Zone so text never overlaps character
const LAYOUT_PROTECTION_RULES = `
### [Layout Protection Rules — CRITICAL] (when text is included)

* Each cell must contain **two clearly separated zones**:
  1. **Subject Zone**: Main silhouette area (character(s), hair, face(s), body/bodies, hands, props).
  2. **Text Zone**: Dedicated area for the short phrase only.

* **Text MUST NOT overlap** the subject silhouette(s). No text on hair, face(s), hands, or props.
* Maintain at least **5–8% visual gap** between the text bounding box and the subject silhouette(s).
* The subject(s) occupy the **visual center**; place text **around** them, not on top.

* **Text placement must vary** across the {TOTAL_FRAMES} cells. Allowed placements:
  - Top center / Bottom center
  - Top left / Top right / Bottom left / Bottom right
  - Slight diagonal offset
  - Beside head (left or right side)

* Do **NOT** use the same text alignment pattern more than twice in a row.
* Text must always remain **fully inside** its cell boundaries (no clipping at edges).
`;

/** Text placement options for per-cell assignment (model-drawn text or programmatic overlay cycle). */
export const LINE_STICKER_TEXT_PLACEMENT_PRESETS: readonly string[] = [
    'Top center',
    'Bottom center',
    'Top left',
    'Top right',
    'Bottom left',
    'Bottom right',
    'Slight diagonal offset (top-left to bottom-right)',
    'Beside head (left)',
    'Beside head (right)',
];

/** Cycle index for programmatic text position (matches v2 per-cell placement diversity). */
export function getLineStickerTextPlacementLabel(frameIndex: number): string {
    return (
        LINE_STICKER_TEXT_PLACEMENT_PRESETS[frameIndex % LINE_STICKER_TEXT_PLACEMENT_PRESETS.length] ??
        'Bottom center'
    );
}

/**
 * Reserved caption band for a cell (0-based). Same label is written into the image
 * generation prompt and used as the anchor when compositing programmatic overlay text.
 */
export function getReservedCaptionBandLabelForFrame(frameIndex: number): string {
    return getLineStickerTextPlacementLabel(frameIndex);
}

/** Fraction of cell height used as reserved caption band (shared with overlay layout). */
export const RESERVED_CAPTION_BAND_HEIGHT_RATIO = 0.28;

/** Short geometry hint appended in the generation prompt so the model clears the same zone the overlay uses. */
export function reservedCaptionBandGeometryHint(placementLabel: string): string {
    const lower = placementLabel.toLowerCase();
    const pct = Math.round(RESERVED_CAPTION_BAND_HEIGHT_RATIO * 100);
    if (lower.includes('bottom')) {
        return ` (keep lowest ~${pct}% of cell height clear, full width minus margins)`;
    }
    if (lower.includes('top') && !lower.includes('beside')) {
        return ` (keep top ~${pct}% of cell height clear, full width minus margins)`;
    }
    if (lower.includes('beside head (left)')) {
        return ' (keep left ~22% width strip clear along mid-height)';
    }
    if (lower.includes('beside head (right)')) {
        return ' (keep right ~22% width strip clear along mid-height)';
    }
    if (lower.includes('diagonal')) {
        return ' (keep lower-right caption corner clear)';
    }
    if (lower.includes('middle center')) {
        return ` (keep horizontal middle ~${pct}% band clear)`;
    }
    return '';
}

function buildProgrammaticOverlayCompositionBullets(bgHex: string): string {
    const pct = Math.round(RESERVED_CAPTION_BAND_HEIGHT_RATIO * 100);
    return `* **Programmatic captions**: A browser step will draw each cell's chat phrase **after** generation. **Do not** render letters, numbers, watermarks, logos, or any typography in the image.
* Each cell line includes **Reserved caption band** with a position name and a geometry hint (e.g. lowest ~${pct}% of the cell). That zone must be **empty solid chroma (${bgHex})** only—no hair, limbs, props, shadows, or subject pixels inside it.
* The position name and band geometry match the overlay anchors; compose the character **outside** that zone. Shrink or shift the subject if needed.
* Vary framing across cells; do not reuse identical subject framing in two consecutive cells.`;
}

/** Fallback when no action description is provided (e.g. theme preset or API failure). */
export const getActionHint = (_phrase: string): string =>
    'natural action and expression matching the text meaning';

/** One-line English action for image prompts (strips CJK parentheticals). */
export function compactEnglishAction(raw: string, maxLen = 55): string {
    const s = raw.trim();
    const enOnly = s
        .replace(/\s*[（(【\[][^)）\]】]*[)）\]】]?/g, '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const use = enOnly.length > 0 ? enOnly : s.replace(/\s+/g, ' ');
    return use.length > maxLen ? `${use.slice(0, maxLen).trim()}…` : use;
}

/** Short band tag for compact programmatic prompts. */
export function compactCaptionBandTag(frameIndex: number): string {
    const label = getReservedCaptionBandLabelForFrame(frameIndex).toLowerCase();
    if (label.includes('bottom') && label.includes('left')) return 'bottom-l';
    if (label.includes('bottom') && label.includes('right')) return 'bottom-r';
    if (label.includes('bottom')) return 'bottom';
    if (label.includes('top') && label.includes('left')) return 'top-l';
    if (label.includes('top') && label.includes('right')) return 'top-r';
    if (label.includes('top')) return 'top';
    if (label.includes('beside') && label.includes('left')) return 'side-l';
    if (label.includes('beside') && label.includes('right')) return 'side-r';
    if (label.includes('diagonal')) return 'diag';
    return 'bottom';
}

export function buildLineStickerPrompt(
    slots: PromptSlots,
    cols: number,
    rows: number,
    bgColor: 'magenta' | 'green',
    includeText: boolean = true,
    actionDescs?: string[],
    promptVersion: LineStickerPromptVersion = 'v3',
    /** When true with includeText false: add composition-only instructions for browser-side caption overlay. */
    reserveForProgrammaticOverlay = false
): string {
    const totalFrames = cols * rows;
    const bgColorText = bgColor === 'magenta' ? 'Pure Magenta #FF00FF' : 'Neon Green #00FF00';

    const cellWidthPct = Math.round(100 / cols);
    const cellHeightPct = Math.round(100 / rows);
    const canvasAspect = getLineStickerCanvasAspectPrompt(cols, rows);
    const bgHex = bgColor === 'magenta' ? '#FF00FF' : '#00FF00';

    if (promptVersion === 'v3compact') {
        const phrasesForFrames = expandThemePhrasesForFrames(
            slots.theme,
            totalFrames,
            slots.text.language
        );
        const perCellLines = phrasesForFrames.map((phrase, index) => {
            const n = index + 1;
            const rawAction =
                actionDescs && actionDescs[index]?.trim()
                    ? actionDescs[index].trim()
                    : getActionHint(phrase);
            const action = compactEnglishAction(rawAction);
            if (!includeText) {
                const band = reserveForProgrammaticOverlay
                    ? ` [band:${compactCaptionBandTag(index)}]`
                    : '';
                return `${n}|${action}${band}`;
            }
            return `${n}|"${phrase}"|${action}`;
        });

        const programmaticNote =
            !includeText && reserveForProgrammaticOverlay
                ? `\n[5b. Caption bands]\nKeep tagged bands empty (chroma only); text is added after slicing.\n`
                : '';

        return `🎨 LINE Sticker Sheet (${cols}×${rows}, compact)

[1. Layout] ${canvasAspect}, ${totalFrames} equal cells (${cellWidthPct}%×${cellHeightPct}%). Logical grid only — NO visible dividers. Continuous ${bgHex}. One subject per cell, ~10% chroma margin.

[2. Style] Match uploaded reference only. ${slots.style.styleType}. ${slots.style.drawingMethod}. Flat shading; same artist across all cells.

[3. Character] Same character(s) as reference in every cell. Consistent face, hair, outfit. Vary pose/expression only.

[4. Background] Solid ${bgColorText} (${bgHex}), uniform, no gradient or texture.

[5. Cells] Row-major. Format: N|"text"|action OR N|action [band:tag]
${perCellLines.join('\n')}${programmaticNote}
[6. Text] ${
            includeText
                ? `${slots.text.language}, ${slots.text.textStyle}, ${slots.text.textColor}. Cycle placement; readable; do not repeat same placement >2× in a row.`
                : 'NO text in image.'
        }

[7. Output] One ${canvasAspect.toLowerCase()} image, ${cols}×${rows}, splittable into ${totalFrames} equal rectangles.`;
    }

    if (promptVersion === 'v2' || promptVersion === 'v3') {
        const hardenedLayout = promptVersion === 'v3';
        const phrasesForFrames = expandThemePhrasesForFrames(
            slots.theme,
            totalFrames,
            slots.text.language
        );
        const actionForImage = (raw: string): string => {
            const s = raw.trim();
            const maxLen = 80;
            const enOnly = s.replace(/\s*[（(].*$/, '').trim();
            const use = enOnly.length > 0 ? enOnly : s;
            return use.length > maxLen ? use.slice(0, maxLen) + '...' : use;
        };
        const perCellBlock = phrasesForFrames.map((phrase, index) => {
            const row = Math.floor(index / cols) + 1;
            const col = (index % cols) + 1;
            const rawAction = (actionDescs && actionDescs[index]?.trim()) ? actionDescs[index].trim() : getActionHint(phrase);
            const actionLabel = actionForImage(rawAction);
            if (!includeText) {
                const bandLabel = getReservedCaptionBandLabelForFrame(index);
                const captionHint = reserveForProgrammaticOverlay
                    ? ` | Reserved caption band (empty chroma; overlay draws text here): ${bandLabel}${reservedCaptionBandGeometryHint(bandLabel)}`
                    : '';
                return `Cell ${index + 1} (row ${row}, col ${col}): Action: ${actionLabel}${captionHint}`;
            }
            const textPosition =
                LINE_STICKER_TEXT_PLACEMENT_PRESETS[index % LINE_STICKER_TEXT_PLACEMENT_PRESETS.length];
            return `Cell ${index + 1} (row ${row}, col ${col}): Text: "${phrase}" | ${textPosition} | ${actionLabel}`;
        }).join('\n');

        const textRules = includeText
            ? `### [6. Text Style]
- Language: ${slots.text.language}
- Font style: ${slots.text.textStyle}
- Color: ${slots.text.textColor}
- Keep text readable and stylistically consistent across all ${totalFrames} stickers.`
            : `### [6. Text Style]
- NO text, letters, numbers, labels, or captions in any cell.`;

        const v2CompositionSection =
            !includeText && reserveForProgrammaticOverlay
                ? `

[5b. Composition for post-render captions]
${buildProgrammaticOverlayCompositionBullets(bgHex)}
`
                : '';

        const globalLayoutBlock = hardenedLayout
            ? `[1. Global Layout — CRITICAL]
- ${canvasAspect}, high resolution
- EXACTLY ${cols}×${rows} sprite sheet (${totalFrames} stickers) — NOT ${cols + 1}×${rows}, NOT ${cols + 1}×${cols + 1}; each cell ${cellWidthPct}% of width × ${cellHeightPct}% of height
- Each horizontal row contains exactly ${cols} stickers (never ${cols + 1})
- Image edges = grid edges. No outer margin or padding on any side.
- NO VISIBLE DIVIDERS (ABSOLUTE, NON-NEGOTIABLE): do NOT draw grid lines, frame lines, borders, boxes, separators, cell outlines, or white/colored strips anywhere between or around cells. The grid is LOGICAL ONLY (used to split the image later).
- Where two cells meet, the background MUST be ONE continuous flat color with ZERO visible seam, line, or gap. Cell boundaries must be completely invisible.
- The white sticker outline goes ONLY around each character silhouette — NEVER along cell edges or image edges.
- Each sticker sits inside its own cell with ~10–15% internal chroma margin; no sticker touches or crosses a cell boundary.
- The image MUST be perfectly splittable into ${totalFrames} equal rectangles.`
            : `[1. Global Layout — CRITICAL]
- ${canvasAspect}, high resolution
- ${cols}×${rows} sprite sheet (${totalFrames} stickers), evenly aligned
- Each cell contains one independent sticker
- No visible grid lines, borders, seams, or divider lines
- Continuous background with no breaks
- Must be cleanly splittable into ${totalFrames} equal parts
- Keep each sticker inside its own area with comfortable spacing`;

        return `🎨 LINE Sticker Sprite Sheet (Nano Banana Optimized, ${promptVersion.toUpperCase()})

${globalLayoutBlock}

[2. Style / Art Consistency — CRITICAL]
- Use ONLY the uploaded reference image as source of character design and visual style
- Do not reinterpret or stylize
- All stickers must look like the same artist drew them in one set
- Flat shading only; no heavy lighting effects
- Style: ${slots.style.styleType}
- Technique: ${slots.style.drawingMethod}

[3. Character Rules — CRITICAL]
- Always draw the same character(s) from the reference image
- If multiple characters appear in reference, include ALL in every cell
- Do not add or remove characters
- Keep face proportions, hairstyle, outfit, and colors consistent
- Only vary expression, pose, gesture, and small props

[4. Background — CRITICAL]
- Use pure solid chroma key background: ${bgColorText} (${bgHex})
- Absolutely uniform color across the entire image
- No gradient, texture, shadows, glow, or color blending
- Clean edges with no semi-transparent fringe

[5. Grid Content — Per Cell]
${includeText
        ? '- Each cell must include one unique expression/action and the assigned text.'
        : '- Each cell must include one unique expression/action.'}
- Keep each cell visually distinct.
${includeText ? '- Place text near the character and keep facial features unobstructed.' : '- Do not render any text in the image.'}

${perCellBlock}
${v2CompositionSection}
${textRules}

[7. Final Output]
- One single image: ${canvasAspect.toLowerCase()}
- ${cols}×${rows} layout (${totalFrames} stickers)
- No visible grid lines${hardenedLayout ? ', borders, seams, or divider lines of any color — cell boundaries fully invisible' : ''}
- Continuous ${bgHex} background${hardenedLayout ? ' that bleeds uniformly across every cell boundary' : ''}
- Cleanly splittable into ${totalFrames} equal rectangles`;
    }

    // 1. Global Layout (basePrompt)
    const layoutPrompt = BASE_PROMPT.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{CELL_WIDTH_PCT}/g, cellWidthPct.toString())
        .replace(/{CELL_HEIGHT_PCT}/g, cellHeightPct.toString())
        .replace(/{CANVAS_ASPECT}/g, canvasAspect)
        .replace(/{AND_TEXT}/g, includeText ? 'and text' : '')
        .replace(/{AND_CLOSE_TEXT}/g, includeText ? 'Subject(s) from reference (e.g. bust/head or group) filling the cell, with text placed clearly.' : 'Subject(s) from reference (e.g. bust/head or group) filling the cell.');

    const layoutProtectionSection = includeText
        ? LAYOUT_PROTECTION_RULES.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        : '';

    // 2. Style / Art Medium (technical: lighting per style; LINE sticker: outline per style or white)
    const outlineRule = slots.style.outlinePreference === 'style'
        ? '* **LINE sticker style**: Visible outline around the subject silhouette(s) as specified by the style (e.g. dark brown or black). Keep it clean and readable on any chat background after the colored background is removed.'
        : '* **LINE sticker style**: Thick white stroke around the subject silhouette(s) only. Clean, visible outline so the sticker stays readable on any chat background after the colored background is removed.';
    const lightingTechnical = slots.style.lightingPreference === 'soft'
        ? '* **Lighting (technical)**: Soft, subtle shading allowed (e.g. gentle wash or soft gradients); no harsh drop shadows or complex lighting. Subject(s) must remain clearly separated from background for clean chroma key.'
        : '* **Lighting (technical)**: Flat shading only. No drop shadows, no gradients, no ambient occlusion. Sharp edges against background.';
    const styleSection = `### [2. Style / Art Medium]

* **Style**: ${slots.style.styleType}
* **Technique**: ${slots.style.drawingMethod}
${lightingTechnical}
${outlineRule}
`;

    // 3. Subject / Character — image-first: uploaded image is primary; preset is optional style hint
    const characterSection = `### [3. Subject / Character] CRITICAL — Image and grid only

* **Subject and style source**: The **uploaded image is the only reference** for who and what to draw, and for the visual style (line weight, shading, proportions, color palette, art style). Do not add or remove subjects. If the reference shows **one** character, draw that one in every cell. If the reference shows **multiple characters** (e.g. two or more people, or a person and a pet), draw **all of them** in every cell—same number, same relative positions and proportions, same composition. Do not simplify to a single character.
* **Layout source**: Sticker separation is defined by the grid only (one composition per cell, cell boundaries as in [1. Global Layout]). Each cell repeats the same subject(s) as in the reference; do not add or drop any character from the reference.
* **Rules**: ${slots.character.originalImageRules}
* **Consistency**: Invariants = number of subjects, face proportions, skin tones, hair silhouettes, outfits, color scheme. Variants = expressions, eye shapes, mouth shapes, gestures, postures, small props.
`;

    // 4. Lighting & Background (technical parameters) — exact hex for chroma key
    const lightingLine = slots.style.lightingPreference === 'soft'
        ? '* **Lighting**: Minimal shadows. Soft shading only; no harsh drop shadows. Ambient occlusion disabled.'
        : '* **Lighting**: No shadows. Flat shading only. Ambient occlusion disabled.';
    const lightingSection = `### [4. Lighting & Background] CRITICAL

* **Background color (exact)**: The entire canvas must be **exactly ${bgColorText}** (hex ${bgHex}). Every cell must use this same color—no gradients, no pink/purple variants (e.g. do NOT use #E91E63 or similar). One single RGB value for all background pixels so that chroma key removal works uniformly.
${lightingLine}
* **Uniform**: Same color across the entire sprite sheet. No ground, clouds, or decorative elements. Subject edges must be sharp and clean against the background.
`;

    // 5. Grid Content — Per cell (local details)
    const phrasesForFrames = expandThemePhrasesForFrames(
        slots.theme,
        totalFrames,
        slots.text.language
    );
    const textRuleCell = includeText ? 'Every cell MUST clearly display its assigned short phrase text.' : 'DO NOT include any text in the images; poses and expressions only.';
    const actionForImage = (raw: string): string => {
        const s = raw.trim();
        const maxLen = 80;
        const enOnly = s.replace(/\s*[（(].*$/, '').trim();
        const use = enOnly.length > 0 ? enOnly : s;
        return use.length > maxLen ? use.slice(0, maxLen) + '...' : use;
    };
    const textPositionRule = includeText
        ? ' Each cell lists a **Text position** — you MUST place the phrase text in that exact position within the cell (e.g. "Top center" = text in the top center of the cell). Do not use the same position for every cell; follow the per-cell instruction.'
        : '';
    const themeContextText = slots.theme.chatContext.trim().length > 0
        ? slots.theme.chatContext.trim()
        : 'General chat conversation';
    const themeSection = `### [5. Grid Content — Per Cell]

* **Theme context**: ${themeContextText}
${textRuleCell}${textPositionRule} Actions and expressions MUST be unique per cell. No repetitions. Vary pose and expression clearly (e.g. different hand gestures, face direction, open/closed eyes) so each cell is visually distinct.

${phrasesForFrames.map((phrase, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        const textLabel = includeText ? `Text: "${phrase}"` : '';
        const rawAction = (actionDescs && actionDescs[index]?.trim()) ? actionDescs[index].trim() : getActionHint(phrase);
        const actionLabel = actionForImage(rawAction);
        const textPosition = includeText
            ? ` | Text position: ${
                  LINE_STICKER_TEXT_PLACEMENT_PRESETS[index % LINE_STICKER_TEXT_PLACEMENT_PRESETS.length]
              }`
            : '';
        const bandLabelV1 = getReservedCaptionBandLabelForFrame(index);
        const captionBandHint =
            !includeText && reserveForProgrammaticOverlay
                ? ` | Reserved caption band (empty chroma; overlay draws text here): ${bandLabelV1}${reservedCaptionBandGeometryHint(bandLabelV1)}`
                : '';
        return includeText
            ? `**Cell ${index + 1} (row ${row}, col ${col})**: ${textLabel}${textPosition} | Action: ${actionLabel}`
            : `**Cell ${index + 1} (row ${row}, col ${col})**: Action: ${actionLabel}${captionBandHint}`;
    }).join('\n')}
`;

    // 6. Text Setting
    let textSection = '';
    if (includeText) {
        textSection = `### [6. Text Setting]

* **Language**: ${slots.text.language}
* **Font style**: ${slots.text.textStyle}
* **Color**: ${slots.text.textColor}
* **Font adherence (CRITICAL)**: Draw every phrase text in the **exact** font style described above. Match the shape, decoration, texture, and visual effect of the font (e.g. bubble outline, crayon stroke, neon glow, pixel blocks). Do not fall back to a generic or plain font—the chosen style must be clearly visible on every cell.
`;
    } else {
        textSection = `### [6. Text Setting]

* **CRITICAL**: No text, letters, or words in any image. Only character poses and expressions.
`;
    }

    const programmaticCompositionSection =
        !includeText && reserveForProgrammaticOverlay
            ? `### [5b. Composition for post-render captions]

${buildProgrammaticOverlayCompositionBullets(bgHex)}

`
            : '';

    // 7. Final Goal
    const finalSection = `
### [7. Final Goal]

Output a single image: ${canvasAspect.toLowerCase()}, {TOTAL_FRAMES} equal rectangles ({COLS}×{ROWS}). Each rectangle = one LINE sticker. Splittable at exactly {CELL_WIDTH_PCT}% width and {CELL_HEIGHT_PCT}% height per cell. Obey [1. Global Layout] — NO VISIBLE DIVIDERS (one continuous background only).
`.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{CELL_WIDTH_PCT}/g, cellWidthPct.toString())
        .replace(/{CELL_HEIGHT_PCT}/g, cellHeightPct.toString());

    return `${layoutPrompt}
${layoutProtectionSection}
${styleSection}
${characterSection}
${lightingSection}
${themeSection}
${programmaticCompositionSection}${textSection}
${finalSection}`;
}

/** Prepended to style-preview prompts so the image pipeline skips chroma-key suffix and post-process. */
export const LINE_STICKER_STYLE_PREVIEW_MARKER = 'STICKER_STYLE_PREVIEW_V1';

export function buildLineStickerStylePreviewPrompt(
    slots: Pick<PromptSlots, 'style' | 'character'>
): string {
    return `${LINE_STICKER_STYLE_PREVIEW_MARKER}

Sticker style preview — single illustrative image (not a production sprite sheet).

### [Goal]
Generate exactly one image from the uploaded reference character.

### [Character Rules]
${slots.character.originalImageRules}

### [Style Rules]
Style: ${slots.style.styleType}
Technique: ${slots.style.drawingMethod}

### [Background — CRITICAL]
- Use a **simple, plain background**: one flat neutral tone (e.g. soft off-white, pale gray-beige, or very light warm gray).
- **Do NOT** use a green screen (#00FF00), **do NOT** use magenta / pink chroma (#FF00FF), and **do NOT** use any pure color meant for keyed removal.
- No busy scenery, patterns, or props. Avoid strong gradients; a barely visible subtle wash is acceptable.

### [Composition]
- Single subject, clear and centered.
- No text, letters, captions, or labels.
- No collage, multi-panel layout, grid, or divider lines.
- One coherent square-friendly illustration.
`;
}

