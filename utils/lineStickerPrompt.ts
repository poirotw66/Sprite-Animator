/**
 * LINE Sticker Prompt Structure
 * 
 * This file implements a modular prompt system with slots:
 * - Base: Core requirements that never change
 * - Style Slot: Art style and visual approach
 * - Character Slot: Character appearance and personality
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
}

export interface CharacterSlot {
    appearance: string;
    personality: string;
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
};

// Global-to-local order: Layout → Style → Subject → Lighting/Background → Per-cell → Text → Final
export const BASE_PROMPT = `🎨 LINE Sticker Sprite Sheet Generation

### [1. Global Layout] CRITICAL

* **Canvas**: Perfect square (1:1 aspect ratio). High resolution output.
* **Grid**: {COLS}×{ROWS} = {TOTAL_FRAMES} cells. Each cell exactly **{CELL_WIDTH_PCT}% of image width** and **{CELL_HEIGHT_PCT}% of image height**.
* **Margins**: None. Image edges = grid boundaries. No empty space at left, right, top, or bottom.
* **Gaps**: No gaps between cells. Adjacent cells share the same boundary. Do not draw dividers or borders.
* **Output**: The image MUST be perfectly splittable into {TOTAL_FRAMES} equal rectangles.
* **Per cell**: Character {AND_TEXT} must occupy ~70–85% of cell height. Minimum internal padding ~5–10%. Character {AND_TEXT} must NOT cross grid lines or touch adjacent cells. One independent sticker per cell. {AND_CLOSE_TEXT}
`;

/** Fallback when no action description is provided (e.g. theme preset or API failure). */
export const getActionHint = (_phrase: string): string =>
    'natural action and expression matching the text meaning (自然動作與表情符合語意)';

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
        .replace(/{AND_CLOSE_TEXT}/g, includeText ? 'Large character (bust or head) filling the cell, with text placed clearly.' : 'Large character (bust or head) filling the cell.');

    // 2. Style / Art Medium (technical: flat shading, no shadows; LINE sticker: white stroke)
    const styleSection = `### [2. Style / Art Medium]

* **Style**: ${slots.style.styleType}
* **Technique**: ${slots.style.drawingMethod}
* **Lighting (technical)**: Flat shading only. No drop shadows, no gradients, no ambient occlusion. Sharp edges against background.
* **LINE sticker style**: Thick white stroke around the character silhouette. Clean, visible outline so the sticker stays readable on any chat background (e.g. dark blue or photo) after the colored background is removed.
`;

    // 3. Subject / Character
    const characterSection = `### [3. Subject / Character]

* **Description**: ${slots.character.appearance}
* **Personality**: ${slots.character.personality}
* **Reference**: Use the uploaded image. Maintain core features (hair, outfit, color palette). Redesign in the requested style. ${slots.character.originalImageRules}
* **Consistency**: Invariants = face proportions, skin tone, hair silhouette, main outfit, color scheme. Variants = expressions, eye shapes, mouth shapes, gestures, postures, small props.
`;

    // 4. Lighting & Background (technical parameters)
    const lightingSection = `### [4. Lighting & Background] CRITICAL

* **Background**: Solid background in **${bgColorText}**. Use this exact color for the entire canvas.
* **Lighting**: No shadows. Flat shading only. Ambient occlusion disabled.
* **Uniform**: Same color across the entire sprite sheet. No ground, clouds, or decorative elements. Character edges must be sharp and clean against the background.
`;

    // 5. Grid Content — Per cell (local details)
    const allPhrases = [...slots.theme.examplePhrases];
    if (slots.theme.specialStickers) allPhrases.push(...slots.theme.specialStickers.texts);
    const phrasesForFrames: string[] = [];
    for (let i = 0; i < totalFrames; i++) {
        phrasesForFrames.push(allPhrases.length > 0 ? allPhrases[i % allPhrases.length] : `Expression ${i + 1}`);
    }
    const textRuleCell = includeText ? 'Every cell MUST clearly display its assigned short phrase text.' : 'DO NOT include any text in the images; poses and expressions only.';
    const themeSection = `### [5. Grid Content — Per Cell]

${textRuleCell} Actions and expressions MUST be unique per cell. No repetitions.

${phrasesForFrames.map((phrase, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        const textLabel = includeText ? `Text: "${phrase}"` : `Theme: "${phrase}" (NO text in image)`;
        const actionLabel = (actionDescs && actionDescs[index]?.trim()) ? actionDescs[index].trim() : getActionHint(phrase);
        return `**Cell ${index + 1} (row ${row}, col ${col})**: ${textLabel} | Action: ${actionLabel}`;
    }).join('\n')}
`;

    // 6. Text Setting
    let textSection = '';
    if (includeText) {
        textSection = `### [6. Text Setting]

* **Language**: ${slots.text.language}
* **Font style**: ${slots.text.textStyle}
* **Color**: ${slots.text.textColor}
`;
    } else {
        textSection = `### [6. Text Setting]

* **CRITICAL**: No text, letters, or words in any image. Only character poses and expressions.
`;
    }

    // 7. Final Goal
    const finalSection = `
### [7. Final Goal]

Output a single image: perfect square, {TOTAL_FRAMES} equal rectangles ({COLS}×{ROWS}). Each rectangle = one LINE sticker. Splittable at exactly {CELL_WIDTH_PCT}% width and {CELL_HEIGHT_PCT}% height per cell.
`.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{CELL_WIDTH_PCT}/g, cellWidthPct.toString())
        .replace(/{CELL_HEIGHT_PCT}/g, cellHeightPct.toString());

    return `${layoutPrompt}
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
        styleType: "Chibi, 2-head body ratio, LINE sticker art style",
        drawingMethod: "Soft hand-drawn, thick clean outlines, soft cell shading",
    },
    pixel: {
        label: '像素藝術',
        styleType: "16-bit Retro Pixel Art, SNES/GBA style, pixel-perfect, limited color palette",
        drawingMethod: "Precise pixel placement, sharp edges no anti-aliasing, clear grid texture and clean lines",
    },
    minimalist: {
        label: '極簡線條',
        styleType: "Minimalist flat illustration, Kanahei style, cute healing sticker look",
        drawingMethod: "Soft thick brown outlines, simple flat color fill, dot eyes and soft blush, rounded simplified shapes",
    },
    anime: {
        label: "日系動漫",
        styleType: "Modern anime style, cell-shaded, high-quality 2D render",
        drawingMethod: "Clean precise lines, two-tone shadows, detailed eyes and hair highlights",
    },
    cartoon: {
        label: "美式卡通",
        styleType: "Vibrant cartoon style, strong motion, exaggerated expressions",
        drawingMethod: "Thick black outlines, saturated color blocks, geometric simplification, commercial illustration feel",
    },
    watercolor: {
        label: "手繪水彩",
        styleType: "Soft watercolor style, healing illustration, natural bleed at edges",
        drawingMethod: "Wet-on-wet technique, hand-drawn brush edges, soft outlines, organic paint flow",
    },
};

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
    appearance: CHARACTER_PRESETS.cute.appearance,
    personality: CHARACTER_PRESETS.cute.personality,
    originalImageRules: 'Do not copy the reference image directly; redesign in the requested style.',
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
