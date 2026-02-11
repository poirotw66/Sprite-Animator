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
    background: string;
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

export const TEXT_COLOR_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    black: { label: '黑色', promptDesc: '黑色 #000000' },
    white: { label: '白色', promptDesc: '白色 #FFFFFF' },
    darkGray: { label: '深灰', promptDesc: '深灰色 #333333' },
    navy: { label: '深藍', promptDesc: '深藍色 #1e3a5f' },
    darkRed: { label: '深紅', promptDesc: '深紅色 #8b0000' },
    brown: { label: '棕色', promptDesc: '棕色 #5c4033' },
};

export const FONT_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    handwritten: { label: '手寫風格', promptDesc: '手寫風格字體' },
    round: { label: '圓體', promptDesc: '圓潤可愛的圓體字' },
    bold: { label: '黑體', promptDesc: '清晰粗黑體' },
    cute: { label: '萌系', promptDesc: '萌系可愛字體' },
    pop: { label: '流行體', promptDesc: '流行活潑字體' },
};

export const BASE_PROMPT = `🎨 LINE Sticker Sprite Sheet Generation

### [Task Description]

Please draw a **Sprite Sheet for LINE stickers**.
Based on the character in the user-provided reference image, create **{TOTAL_FRAMES} Chibi-style bust stickers**,
arranged in a **{COLS} × {ROWS} grid layout**. Each cell must be clear and divisible into an individual LINE sticker.

**Character Reference Instructions**:
* Refer to the character design in the uploaded image.
* Maintain core features (hair style, outfit, color palette, etc.).
* Convert the character into a Chibi style while maintaining recognizability.

**Critical Reminders**:
{TEXT_RULE_1}
* Actions, facial expressions, and text/visual themes MUST be unique for every single cell.

---

### [Sprite Sheet Layout] CRITICAL

* Layout Specifications:
  **The entire image MUST be a strict {COLS} × {ROWS} grid (total {TOTAL_FRAMES} cells).**
  * Divide the image equally into {COLS} columns from left to right and {ROWS} rows from top to bottom.
  * **No Outer Margins**: The image edges are the grid boundaries. No empty space at the very left, right, top, or bottom.
  * **No Gaps Between Cells**: Adjacent cells share the same boundary lines. Do not draw separating lines or leave gaps.

* Filling Rules per Cell (Very Important):
  * **Character {AND_TEXT} MUST fill the cell as much as possible**: The character should occupy ~70%–85% of the cell height. Avoid small characters with large empty spaces.
  * Maintain minimum internal padding (~5%–10%) to avoid cutting off parts of the face or text.
  * ❌ FORBIDDEN: Small character in the center with large wasted space around.
  * ✅ CORRECT: Large character (bust or head) filling the cell, {AND_CLOSE_TEXT} creating a full visual impact.

* Strict Layout Rules:
  * Each cell = One independent LINE sticker.
  * Character {AND_TEXT} **MUST NOT cross grid lines or touch adjacent cells**.
  * DO NOT show any dividers, lines, or borders between cells.

---

### [Expression Design Principles]

* Each sticker must correspond to a **single, clear emotion**.
* **Actions, expressions, and text MUST be different for every cell**—no repetitions allowed.
* Expressions should include: Facial features + Body language/postures (gestures, posture, props).
{TEXT_RULE_2}

---

### [Character Consistency Rules]

* Invariants (must stay the same): Face proportions, skin tone, hair silhouette, main outfit, and color scheme.
* Variants (allowed to change): Expressions, eye shapes, mouth shapes, gestures, postures, and small props (theme-related).

---

### [Background Requirement]

The background must be a solid, flat color: **{BG_COLOR}**.
No scenes, gradients, shadows, or other background elements allowed.

---

### [Final Goal] Generate a sprite sheet that can be perfectly divided into {COLS}×{ROWS} equal parts.
`;

/**
 * Generate action suggestions based on phrase
 */
export const getActionHint = (phrase: string): string => {
    if (phrase.includes('成功') || phrase.includes('升級') || phrase.includes('Success') || phrase.includes('Level Up')) return 'raising hands in celebration, happy laugh, thumbs up';
    if (phrase.includes('失敗') || phrase.includes('歸零') || phrase.includes('Fail') || phrase.includes('Zero')) return 'dejected look, helpless expression, shrugging';
    if (phrase.includes('查') || phrase.includes('規則') || phrase.includes('Check') || phrase.includes('Rule')) return 'flipping through a book, thinking, focused look';
    if (phrase.includes('骰') || phrase.includes('檢定') || phrase.includes('暗骰') || phrase.includes('Dice') || phrase.includes('Roll')) return 'throwing dice, waiting tensely, checking result';
    if (phrase.includes('暴擊') || phrase.includes('攻擊') || phrase.includes('Critical') || phrase.includes('Attack')) return 'punching, combat stance, excited expression';
    if (phrase.includes('技能') || phrase.includes('Skill')) return 'casting spell gesture, move stance, focused expression';
    if (phrase.includes('早安') || phrase.includes('晚安') || phrase.includes('Morning') || phrase.includes('Night')) return 'waving, smiling, greeting';
    if (phrase.includes('謝謝') || phrase.includes('不客氣') || phrase.includes('Thanks')) return 'bowing, nodding, friendly smile';
    if (phrase.includes('辛苦了') || phrase.includes('加油') || phrase.includes('Work hard') || phrase.includes('Go for it')) return 'thumbs up, encouraging gesture, warm smile';
    if (phrase.includes('好累') || phrase.includes('累') || phrase.includes('Tired')) return 'yawning, exhausted expression, wiping sweat';
    if (phrase.includes('開心') || phrase.includes('哈哈') || phrase.includes('Happy') || phrase.includes('Haha')) return 'laughing, jumping, Peace sign';
    if (phrase.includes('嗚嗚') || phrase.includes('Sob')) return 'wiping tears, aggrieved, crying expression';
    if (phrase.includes('咦') || phrase.includes('Huh')) return 'tilting head, confused, question mark expression';
    if (phrase.includes('收到') || phrase.includes('了解') || phrase.includes('OK') || phrase.includes('Got it')) return 'nodding, OK gesture, confirmed expression';
    if (phrase === 'KKT' || phrase === 'KKO') return 'looking towards audience with great anticipation, cute expression';
    return 'natural action and expression matching the text meaning';
};

export function buildLineStickerPrompt(
    slots: PromptSlots,
    cols: number,
    rows: number,
    bgColor: 'magenta' | 'green',
    includeText: boolean = true
): string {
    const totalFrames = cols * rows;
    const bgColorText = bgColor === 'magenta' ? 'magenta #FF00FF' : 'green #00FF00';

    const characterSection = `### [Character Setting]\n* Description: ${slots.character.appearance}\n* Personality: ${slots.character.personality}\n* Rules: ${slots.character.originalImageRules}\n\n`;
    const styleSection = `### [Style Setting]\n* Style: ${slots.style.styleType}\n* Technique: ${slots.style.drawingMethod}\n* Background: ${slots.style.background}\n\n`;

    const allPhrases = [...slots.theme.examplePhrases];
    if (slots.theme.specialStickers) allPhrases.push(...slots.theme.specialStickers.texts);

    const phrasesForFrames: string[] = [];
    for (let i = 0; i < totalFrames; i++) {
        phrasesForFrames.push(allPhrases.length > 0 ? allPhrases[i % allPhrases.length] : `Expression ${i + 1}`);
    }

    const themeSection = `### [Requirements Per Cell]\n${phrasesForFrames.map((phrase, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        const textInstruction = includeText ? `Display text: "${phrase}"` : `Theme: "${phrase}" (NO text allowed)`;
        return `**Cell ${index + 1} (${row}, ${col})**: ${textInstruction} - ${getActionHint(phrase)}`;
    }).join('\n')}\n\n`;

    let textSection = '';
    if (includeText) {
        textSection = `### [Text Setting]\n* Language: ${slots.text.language}\n* Style: ${slots.text.textStyle}\n* Color: ${slots.text.textColor}\n`;
    } else {
        textSection = `### [NO Text Requirement]\n* **CRITICAL**: DO NOT include any text, letters, or words in the images. Only the character poses and expressions are allowed.\n`;
    }

    const basePrompt = BASE_PROMPT.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{BG_COLOR}/g, bgColorText)
        .replace(/{TEXT_RULE_1}/g, includeText ? '* Every sticker MUST clearly display its corresponding short phrase text.' : '* NO text allowed in any stickers.')
        .replace(/{AND_TEXT}/g, includeText ? 'and text' : '')
        .replace(/{AND_CLOSE_TEXT}/g, includeText ? 'with text placed closely,' : '')
        .replace(/{TEXT_RULE_2}/g, includeText ? '* **Every cell MUST clearly display its corresponding short phrase.**' : '* **DO NOT include any text in the images.**');

    return `${basePrompt}${characterSection}${styleSection}${themeSection}${textSection}`;
}

export const DEFAULT_THEME_SLOT: ThemeSlot = {
    chatContext: 'TRPG 跑團',
    examplePhrases: ['查規則書...', '骰子成功！', '暗骰中...', '暴擊！', '大失敗...', 'GM 手下留情', '先攻檢定！', '豁免檢定！'],
    specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
};

export const DEFAULT_TEXT_SLOT: TextSlot = {
    language: '繁體中文',
    textStyle: FONT_PRESETS.handwritten.promptDesc,
    textColor: TEXT_COLOR_PRESETS.black.promptDesc,
    lengthConstraints: { chinese: '建議 2～6 個字', english: '建議 1～3 個單字' }
};

export const THEME_PRESETS: Record<string, ThemeSlot & { label: string }> = {
    trpg: { ...DEFAULT_THEME_SLOT, label: 'TRPG 跑團' },
    daily: {
        label: '日常聊天',
        chatContext: '日常聊天',
        examplePhrases: ['早安', '晚安', '謝謝', '不客氣', '辛苦了', '加油', '好累', '開心', '哈哈', '嗚嗚', '咦？', '嗯嗯', '好啊', '不要啦', '等等我', '想你了'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    social: {
        label: '社群互動',
        chatContext: '社群互動',
        examplePhrases: ['讚', '推', '分享', '轉發', '收藏', '訂閱', '按讚', '留言', '已讀', '笑死', '太神', '愛了', '必看', '推爆', '跪了', '神作'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    workplace: {
        label: '職場對話',
        chatContext: '職場對話',
        examplePhrases: ['收到', '了解', '已完成', '進行中', '稍等', '沒問題', '辛苦了', '謝謝', '再確認', '已寄出', '明天見', '開會中', '請稍候', '交給我', 'OK', '請查收'],
        specialStickers: { description: '角色滿懷期待地看向觀眾', texts: ['KKT', 'KKO'] }
    },
    emotion: {
        label: '情緒表現',
        chatContext: '極端情緒表現',
        examplePhrases: ['暴怒', '崩潰', '大哭', '狂笑', '發呆', '震驚', '翻白眼', '懷疑人生', '心碎', '撒嬌', '生悶氣', '臉紅', '尷尬', '鄙視', '崇拜', '驚嚇'],
        specialStickers: { description: '角色滿臉通紅害羞的樣子', texts: ['(///▽///)', '羞'] }
    },
    meme: {
        label: '迷因梗圖',
        chatContext: '網路流行語與迷因',
        examplePhrases: ['真香', '小朋友才做選擇', '我全都要', '我就爛', '你各位啊', '是在哈囉', '歸剛欸', '哭啊', '奇怪的知識增加了', '芭比 Q 了', '太狠了', '我的超人', '計畫通', '我就靜靜看著你'],
        specialStickers: { description: '角色露出經典的「計畫通」表情', texts: ['計畫通', '掌握全局'] }
    },
    food: {
        label: '美食饕客',
        chatContext: '關於食物與用餐',
        examplePhrases: ['餓了', '想吃肉', '宵夜時間', '珍珠奶茶', '好飽', '美食萬歲', '減肥明天再說', '外送到了', '分我一口', '真好吃', '看起來很雷', '這味道...', '大受好評', '美味十足'],
        specialStickers: { description: '角色幸福地吃著大餐的樣子', texts: ['大滿足', '還要吃'] }
    }
};

export const STYLE_PRESETS: Record<string, { label: string } & StyleSlot> = {
    chibi: {
        label: 'Q 版可愛',
        styleType: "Q 版 (Chibi), 2-head body ratio, LINE sticker art style",
        drawingMethod: "彩色手繪風格 (Soft hand-drawn), 粗線條 (Thick clean outlines), 柔和賽璐璐陰影 (Soft cell shading)",
        background: '純色粉嫩背景 (Solid pastel background), 獨立構圖 (Isolated for easy clipping)'
    },
    pixel: {
        label: '像素藝術',
        styleType: "16-bit 復古像素風格 (Pixel Art), 高對比調色盤, 具備 SNES/GBA 遊戲質感",
        drawingMethod: "精確像素點繪, 保持邊緣銳利無平滑模糊 (No anti-aliasing), 強化格狀紋理與乾淨線條",
        background: "純色背景，確保像素邊緣清晰不渲染"
    },
    minimalist: {
        label: '極簡線條',
        styleType: "極簡扁平插畫 (Minimalist Flat), 卡娜赫拉風格 (Kanahei style), 療癒系可愛貼圖",
        drawingMethod: "柔和的深棕色粗輪廓線 (Soft thick outlines), 簡單純色填充, 點點眼與粉嫩腮紅細節, 圓潤簡化的形狀",
        background: "純色粉嫩背景 (Solid pastel background), 獨立構圖 (Isolated for easy clipping)"
    },
    anime: {
        label: "日系動漫",
        styleType: "現代精緻日系動漫風格 (Modern Anime), 賽璐珞風格 (Cell-shaded), 高畫質 2D 渲染",
        drawingMethod: "細膩俐落的線條, 二級陰影層次 (Two-tone shadows), 精緻的眼部細節與髮絲反光",
        background: "純淨淺色背景, 確保主體輪廓邊緣清晰"
    },
    cartoon: {
        label: "美式卡通",
        styleType: "現代美式卡通風格 (Vibrant Cartoon), 動態張力強, 角色表情誇張",
        drawingMethod: "粗黑且穩定的外框線, 飽和對比色塊填充, 簡單的幾何化結構, 具備商業插畫感",
        background: "高飽和度純色背景, 無陰影渲染, 呈現完全扁平化 (Flat design)"
    },
    watercolor: {
        label: "手繪水彩",
        styleType: "柔和日系手繪水彩風格 (Soft Watercolor), 療癒系插畫, 邊緣帶有自然擴散感",
        drawingMethod: "層次透明水漬暈染 (Wet-on-wet technique), 手繪筆觸邊緣, 柔和邊緣線條, 具備物理墨水流動感",
        background: "米白色紙張紋理背景 (Canvas texture), 模擬真實水彩紙效果"
    }
};

export const DEFAULT_CHARACTER_SLOT: CharacterSlot = {
    appearance: '可愛、的人物形象',
    personality: '溫柔、害羞',
    originalImageRules: '不可直接複製原圖，需重新設計',
};

export const TEXT_PRESETS: Record<string, TextSlot & { label: string }> = {
    'zh-TW': { ...DEFAULT_TEXT_SLOT, label: '繁體中文' },
    'zh-CN': {
        label: '简体中文',
        language: '簡體中文',
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
        language: '日本語',
        textStyle: '手書きスタイルフォント',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: { chinese: '建議 2～6 個字', english: '建議 1～3 個單字' }
    }
};
