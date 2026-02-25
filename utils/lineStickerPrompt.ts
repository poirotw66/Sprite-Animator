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

export interface PromptSlots {
    style: StyleSlot;
    character: CharacterSlot;
    theme: ThemeSlot;
    text: TextSlot;
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

export type ThemeOption = keyof typeof THEME_PRESETS | 'custom';

export interface ThemeSlot {
    chatContext: string;
    examplePhrases: string[];
    specialStickers?: {
        description: string;
        texts: string[];
    };
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

// promptDesc: English for image model; label: for UI (e.g. zh-TW)
export const TEXT_COLOR_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    black: { label: '黑色', promptDesc: 'Black #000000' },
    white: { label: '白色', promptDesc: 'White #FFFFFF' },
    darkGray: { label: '深灰', promptDesc: 'Dark gray #333333' },
    navy: { label: '深藍', promptDesc: 'Navy blue #1e3a5f' },
    darkRed: { label: '深紅', promptDesc: 'Dark red #8b0000' },
    brown: { label: '棕色', promptDesc: 'Brown #5c4033' },
};

export const FONT_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    handwritten: { label: '手寫風格', promptDesc: 'Hand-written style font' },
    round: { label: '圓體', promptDesc: 'Round, soft font' },
    bold: { label: '黑體', promptDesc: 'Bold sans-serif' },
    cute: { label: '萌系', promptDesc: 'Cute, playful font' },
    pop: { label: '流行體', promptDesc: 'Pop, trendy font' },
    pinkBubble: { label: '粉嫩泡泡風', promptDesc: 'Pink bubble font, thick white border, floating hearts, kawaii' },
    thinHandwritten: { label: '簡約手繪風', promptDesc: 'Thin handwritten style, sparkles, stars, whimsical doodle' },
    catEar: { label: '貓耳裝飾體', promptDesc: 'Black rounded font, cat ear accents, feline theme, minimalist' },
    crayon: { label: '蠟筆筆觸風', promptDesc: 'Red crayon texture, hand-drawn, waxy stroke, childlike' },
    stitched: { label: '虛線縫紉體', promptDesc: 'Dashed line font, stitched effect, sewing style, craft aesthetic' },
    puffyCloud: { label: '雲朵蓬蓬體', promptDesc: 'Puffy cloud font, thick black outline, blue sky background' },
    cherryBlossom: { label: '櫻花點綴體', promptDesc: 'Dark brown font, cherry blossom accents, floral theme, elegant' },
    animalPartners: { label: '動物夥伴風', promptDesc: 'Pink rounded font, cute animal icons, bears and cats, sticker' },
    pastel3d: { label: '粉彩漸層 3D', promptDesc: 'Pastel gradient, 3D drop shadow, sticker cut-out, soft colors' },
    bobaPearl: { label: '珍奶珍珠體', promptDesc: 'Bubble tea theme, boba pearls inside letters, brown gradient' },
    neonGlow: { label: '霓虹放光體', promptDesc: 'Neon glow font, red-orange light, dark background, electric' },
    marshmallowCloud: { label: '棉花糖雲朵', promptDesc: 'Marshmallow font, purple pink gradient, dreamy cloud background' },
    pixelRetro: { label: '復古像素風', promptDesc: '8-bit pixel art, rainbow gradient, retro gaming style' },
    rainbowConfetti: { label: '彩虹碎片體', promptDesc: 'Rainbow color font, confetti background, party celebration' },
    chalkboard: { label: '黑板粉筆風', promptDesc: 'Chalkboard style, white chalk texture, hand-drawn doodles' },
    comicBook: { label: '美式漫畫風', promptDesc: 'Comic book style, bold outlines, pop art, action background' },
};

/** Display order for font dropdown: classic first, then themed styles. */
export const FONT_PRESET_ORDER: (keyof typeof FONT_PRESETS)[] = [
    'handwritten',
    'round',
    'bold',
    'cute',
    'pop',
    'pinkBubble',
    'thinHandwritten',
    'catEar',
    'crayon',
    'stitched',
    'puffyCloud',
    'cherryBlossom',
    'animalPartners',
    'pastel3d',
    'bobaPearl',
    'neonGlow',
    'marshmallowCloud',
    'pixelRetro',
    'rainbowConfetti',
    'chalkboard',
    'comicBook',
];

// Global-to-local order: Layout → Style → Subject → Lighting/Background → Per-cell → Text → Final
export const BASE_PROMPT = `🎨 LINE Sticker Sprite Sheet Generation

### [1. Global Layout] CRITICAL

* **Canvas**: Perfect square (1:1 aspect ratio). High resolution output.
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

/** Text placement options for per-cell assignment. Cycle through these so each cell has an explicit, diverse position. */
const TEXT_PLACEMENTS: readonly string[] = [
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

/** Fallback when no action description is provided (e.g. theme preset or API failure). */
export const getActionHint = (_phrase: string): string =>
    'natural action and expression matching the text meaning';

export function buildLineStickerPrompt(
    slots: PromptSlots,
    cols: number,
    rows: number,
    bgColor: 'magenta' | 'green',
    includeText: boolean = true,
    actionDescs?: string[]
): string {
    const totalFrames = cols * rows;
    const bgColorText = bgColor === 'magenta' ? 'Pure Magenta #FF00FF' : 'Neon Green #00FF00';

    const cellWidthPct = Math.round(100 / cols);
    const cellHeightPct = Math.round(100 / rows);

    // 1. Global Layout (basePrompt)
    const layoutPrompt = BASE_PROMPT.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{CELL_WIDTH_PCT}/g, cellWidthPct.toString())
        .replace(/{CELL_HEIGHT_PCT}/g, cellHeightPct.toString())
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
    const bgHex = bgColor === 'magenta' ? '#FF00FF' : '#00FF00';
    const lightingLine = slots.style.lightingPreference === 'soft'
        ? '* **Lighting**: Minimal shadows. Soft shading only; no harsh drop shadows. Ambient occlusion disabled.'
        : '* **Lighting**: No shadows. Flat shading only. Ambient occlusion disabled.';
    const lightingSection = `### [4. Lighting & Background] CRITICAL

* **Background color (exact)**: The entire canvas must be **exactly ${bgColorText}** (hex ${bgHex}). Every cell must use this same color—no gradients, no pink/purple variants (e.g. do NOT use #E91E63 or similar). One single RGB value for all background pixels so that chroma key removal works uniformly.
${lightingLine}
* **Uniform**: Same color across the entire sprite sheet. No ground, clouds, or decorative elements. Subject edges must be sharp and clean against the background.
`;

    // 5. Grid Content — Per cell (local details)
    const allPhrases = [...slots.theme.examplePhrases];
    if (slots.theme.specialStickers) allPhrases.push(...slots.theme.specialStickers.texts);
    const phrasesForFrames: string[] = [];
    for (let i = 0; i < totalFrames; i++) {
        phrasesForFrames.push(allPhrases.length > 0 ? allPhrases[i % allPhrases.length] : `Expression ${i + 1}`);
    }
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
    const themeSection = `### [5. Grid Content — Per Cell]

${textRuleCell}${textPositionRule} Actions and expressions MUST be unique per cell. No repetitions. Vary pose and expression clearly (e.g. different hand gestures, face direction, open/closed eyes) so each cell is visually distinct.

${phrasesForFrames.map((phrase, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        const textLabel = includeText ? `Text: "${phrase}"` : `Theme: "${phrase}" (NO text in image)`;
        const rawAction = (actionDescs && actionDescs[index]?.trim()) ? actionDescs[index].trim() : getActionHint(phrase);
        const actionLabel = actionForImage(rawAction);
        const textPosition = includeText ? ` | Text position: ${TEXT_PLACEMENTS[index % TEXT_PLACEMENTS.length]}` : '';
        return `**Cell ${index + 1} (row ${row}, col ${col})**: ${textLabel}${textPosition} | Action: ${actionLabel}`;
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

    // 7. Final Goal
    const finalSection = `
### [7. Final Goal]

Output a single image: perfect square, {TOTAL_FRAMES} equal rectangles ({COLS}×{ROWS}). Each rectangle = one LINE sticker. Splittable at exactly {CELL_WIDTH_PCT}% width and {CELL_HEIGHT_PCT}% height per cell. Obey [1. Global Layout] — NO VISIBLE DIVIDERS (one continuous background only).
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
${textSection}
${finalSection}`;
}

export const DEFAULT_THEME_SLOT: ThemeSlot = {
    chatContext: 'TRPG tabletop RPG session',
    examplePhrases: ['查規則書...', '骰子成功！', '暗骰中...', '暴擊！', '大失敗...', 'GM 手下留情', '先攻檢定！', '豁免檢定！'],
    specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
};

// language/textStyle/textColor in prompt = English for image model; label = for UI
export const DEFAULT_TEXT_SLOT: TextSlot = {
    language: 'Traditional Chinese',
    textStyle: FONT_PRESETS.handwritten.promptDesc,
    textColor: TEXT_COLOR_PRESETS.black.promptDesc,
    lengthConstraints: { chinese: '建議 2～6 個字', english: '建議 1～3 個單字' }
};

// label: for UI; chatContext: English for image model; examplePhrases: sticker text (any language)
export const THEME_PRESETS: Record<string, ThemeSlot & { label: string }> = {
    trpg: { ...DEFAULT_THEME_SLOT, label: 'TRPG 跑團' },
    daily: {
        label: '日常聊天',
        chatContext: 'Daily casual chat',
        examplePhrases: ['早安', '晚安', '謝謝', '不客氣', '辛苦了', '加油', '好累', '開心', '哈哈', '嗚嗚', '咦？', '嗯嗯', '好啊', '不要啦', '等等我', '想你了'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    social: {
        label: '社群互動',
        chatContext: 'Social media interaction',
        examplePhrases: ['讚', '推', '分享', '轉發', '收藏', '訂閱', '按讚', '留言', '已讀', '笑死', '太神', '愛了', '必看', '推爆', '跪了', '神作'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    workplace: {
        label: '職場對話',
        chatContext: 'Workplace communication',
        examplePhrases: ['收到', '了解', '已完成', '進行中', '稍等', '沒問題', '辛苦了', '謝謝', '再確認', '已寄出', '明天見', '開會中', '請稍候', '交給我', 'OK', '請查收'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    emotion: {
        label: '情緒表現',
        chatContext: 'Strong emotions and expressions',
        examplePhrases: ['暴怒', '崩潰', '大哭', '狂笑', '發呆', '震驚', '翻白眼', '懷疑人生', '心碎', '撒嬌', '生悶氣', '臉紅', '尷尬', '鄙視', '崇拜', '驚嚇'],
        specialStickers: { description: '角色滿臉通紅害羞的樣子', texts: ['(///▽///)', '羞'] }
    },
    meme: {
        label: '迷因梗圖',
        chatContext: 'Internet memes and viral phrases',
        examplePhrases: ['真香', '小朋友才做選擇', '我全都要', '我就爛', '你各位啊', '是在哈囉', '歸剛欸', '哭啊', '奇怪的知識增加了', '芭比 Q 了', '太狠了', '我的超人', '計畫通', '我就靜靜看著你'],
        specialStickers: { description: '角色露出經典的「計畫通」表情', texts: ['計畫通', '掌握全局'] }
    },
    food: {
        label: '美食饕客',
        chatContext: 'Food and dining',
        examplePhrases: ['餓了', '想吃肉', '宵夜時間', '珍珠奶茶', '好飽', '美食萬歲', '減肥明天再說', '外送到了', '分我一口', '真好吃', '看起來很雷', '這味道...', '大受好評', '美味十足'],
        specialStickers: { description: '角色幸福地吃著大餐的樣子', texts: ['大滿足', '還要吃'] }
    }
};

// label: for UI (zh-TW); styleType / drawingMethod: English for image model
export const STYLE_PRESETS: Record<string, { label: string } & StyleSlot> = {
    chibi: {
        label: 'Q 版可愛',
        styleType: "Chibi, 2-head body ratio, LINE sticker art style, versatile for any character type",
        drawingMethod: "Soft hand-drawn, thick clean outlines, soft cell shading",
    },
    pixel: {
        label: '像素藝術',
        styleType: "16-bit Retro Pixel Art, SNES/GBA style, pixel-perfect",
        drawingMethod: "Precise pixel placement, sharp edges no anti-aliasing, clear grid texture and clean lines",
    },
    minimalist: {
        label: '極簡線條',
        styleType: "Minimalist flat illustration, Kanahei style, cute healing sticker look",
        drawingMethod: "Soft thick outlines, simple flat color fill, dot eyes and soft cheek detail, rounded simplified shapes",
        outlinePreference: 'style',
    },
    anime: {
        label: "日系動漫",
        styleType: "Modern anime style, cell-shaded, high-quality 2D render",
        drawingMethod: "Clean precise lines, two-tone shadows, detailed eyes and hair highlights",
    },
    cartoon: {
        label: "美式卡通",
        styleType: "Vibrant cartoon style, strong motion, exaggerated expressions",
        drawingMethod: "Thick dark outlines, saturated color blocks, geometric simplification, commercial illustration feel",
        outlinePreference: 'style',
    },
    watercolor: {
        label: "手繪水彩",
        styleType: "Soft watercolor style, healing illustration, natural bleed at edges",
        drawingMethod: "Wet-on-wet technique, hand-drawn brush edges, soft outlines, organic paint flow",
        lightingPreference: 'soft',
    },
    yurukawa: {
        label: "慵懶軟懶風",
        styleType: "Yuru-kawa style, kawaii aesthetic, chibi, Japanese healing and lazy atmosphere, relaxed and lazy vibe, funny expression, suitable for personified characters (tired, lazy, cute)",
        drawingMethod: "Simple line art, marker coloring style, low saturation, simple vector art. Avoid: photorealistic, highly detailed, volumetric lighting, glossy finish, complex background, serious tone.",
    },
    pastel: {
        label: "蠟筆粉彩",
        styleType: "Soft pastel and crayon style, dreamy and gentle, kawaii sticker look",
        drawingMethod: "Pastel or wax crayon texture, soft edges, low saturation, rounded shapes, gentle shading",
    },
    flat: {
        label: "扁平時尚",
        styleType: "Flat design illustration, modern app and icon style, geometric simplification",
        drawingMethod: "Solid flat color blocks, minimal or no gradients, clean vector shapes, no soft shadows",
    },
    doodle: {
        label: "塗鴉手繪",
        styleType: "Casual doodle and sketch style, hand-drawn feel, playful and loose",
        drawingMethod: "Sketchy or marker-like lines, slightly imperfect outlines, simple fills, notebook or memo vibe",
    },
    gouache: {
        label: "不透明水彩",
        styleType: "Gouache and opaque watercolor style, matte and soft, picture-book illustration feel",
        drawingMethod: "Flat opaque color layers, soft brush edges, minimal blending",
        lightingPreference: 'soft',
    },
    lineChibi: {
        label: "日系貼圖暖色",
        styleType: "Cute chibi character in Japanese LINE sticker style, suitable for animals and mascots. Hand-drawn digital illustration with thick dark outlines and flat colors. Round, squishy body, tiny paws, minimalist expressive facial expressions.",
        drawingMethod: "High contrast, minimalist and cozy aesthetic. Isolated character, clean and readable for stickers. Avoid: photorealistic, complex shading, busy details.",
        outlinePreference: 'style',
    },
};

/** Style key: preset key or 'custom' for user-defined style. */
export type LineStickerStyleOption = keyof typeof STYLE_PRESETS | 'custom';

/** Display order for style dropdown: recommended and LINE-friendly first, then variety. */
export const STYLE_PRESET_ORDER: (keyof typeof STYLE_PRESETS)[] = [
    'chibi',
    'lineChibi',
    'minimalist',
    'yurukawa',
    'anime',
    'watercolor',
    'pastel',
    'cartoon',
    'flat',
    'doodle',
    'gouache',
    'pixel',
];

// label: for UI; appearance / personality: English for image model
export const CHARACTER_PRESETS: Record<string, { label: string; appearance: string; personality: string }> = {
    cute: {
        label: '可愛萌系 (Default)',
        appearance: 'Round cute character, approachable, big eyes and soft blush',
        personality: 'Gentle, shy, healing'
    },
    funny: {
        label: '搞怪幽默 (Meme Style)',
        appearance: 'Exaggerated poses, funny expressions, meme-like energy',
        personality: 'Humorous, quirky, unpredictable'
    },
    cool: {
        label: '酷帥型格 (Cool)',
        appearance: 'Sharp lines, sharp eyes, cool handsome look',
        personality: 'Confident, calm, deep'
    },
    energetic: {
        label: '陽光活力 (Energetic)',
        appearance: 'Dynamic, bright colors, full of energy',
        personality: 'Passionate, positive, sunny'
    },
    healing: {
        label: '軟萌療癒 (Healing)',
        appearance: 'Soft minimal lines, marshmallow-like feel, gentle shape',
        personality: 'Quiet, gentle, healing'
    },
    elegant: {
        label: '優雅氣質 (Elegant)',
        appearance: 'Refined elegant look, slender flowing lines, graceful pose',
        personality: 'Intellectual, elegant, gentle'
    }
};

export const DEFAULT_CHARACTER_SLOT: CharacterSlot = {
    originalImageRules: 'Draw exactly the subject(s) and visual style from the reference image. If the reference has multiple characters, include all of them in every cell with the same composition. Do not reduce to one character. Layout follows the sticker grid (one composition per cell).',
};

export const TEXT_PRESETS: Record<string, TextSlot & { label: string }> = {
    'zh-TW': { ...DEFAULT_TEXT_SLOT, label: '繁體中文' },
    'zh-CN': {
        label: '简体中文',
        language: 'Simplified Chinese',
        textStyle: FONT_PRESETS.handwritten.promptDesc,
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '建議 2～6 個字', english: '建議 1～3 個單字' }
    },
    en: {
        label: 'English',
        language: 'English',
        textStyle: 'Hand-written style font',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '建議 2～6 個字', english: '建議 1～3 個單字' }
    },
    ja: {
        label: '日本語',
        language: 'Japanese',
        textStyle: 'Hand-written style font',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '建議 2～6 個字', english: '建議 1～3 個單字' }
    }
};
