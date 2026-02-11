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

export const BASE_PROMPT = `🎨 LINE 貼圖精靈圖生成

### 【任務說明】

請繪製一張 **LINE 貼圖用的精靈圖（Sprite Sheet）**，
內容為參考使用者上傳的圖片中的角色，繪製 **{TOTAL_FRAMES} 個 Q 版半身像表情貼圖**，
以 **{COLS} × {ROWS} 網格布局** 排列，每一格皆可獨立拆分成單一 LINE 貼圖使用。

**角色參考說明**：
* 請參考使用者上傳的圖片中的角色設計
* 保持角色的基本特徵（髮型、服裝、配色等）
* 將角色轉換為 Q 版風格，但保留原角色的辨識度

**重要提醒**：
* 每一格都必須在貼圖上清晰顯示對應的短語文字
* 每一格的動作、表情、文字都必須不同

---

### 【精靈圖布局（Sprite Sheet Layout）】CRITICAL

* 布局規格：
  **整張圖必須是嚴格的 {COLS} × {ROWS} 網格（共 {TOTAL_FRAMES} 格）**
  * 整張圖從左到右均分為 {COLS} 欄、從上到下均分為 {ROWS} 列
  * **不得有外圍留白**：圖像四邊即為網格邊界，最左、最右、最上、最下都不許有多餘空白
  * 格與格之間 **不得有間隙**：相鄰格子共用同一條邊線，不可畫出分隔線或留空

* 每一格的填滿規則（非常重要）：
  * **角色與文字必須盡量填滿該格**：角色約佔單格高度的 70%～85%，避免角色過小、周圍大片空白
  * 單格內只保留極少內邊距（約 5%～10%）避免裁切到臉或文字，其餘空間應由角色與文字佔滿
  * ❌ 禁止：角色小小一個在格子中央、四周大量留白
  * ✅ 正確：角色放大、半身或頭部填滿格子，文字緊鄰角色，整體視覺飽滿

* 布局規則（嚴格遵守）：
  * 每一格 = 一張可獨立使用的 LINE 貼圖
  * 角色與文字 **不得跨越格線或接觸相鄰格子**
  * 不可顯示任何分隔線、格線或邊框

---

### 【表情設計原則（非常重要）】

* 每一格貼圖需對應 **單一、明確的情緒**
* **每一格的動作、表情、文字都必須不同**，絕對不能重複
* 表情需包含：臉部表情＋肢體動作（如手勢、姿勢、道具）
* **每一格都必須在貼圖上清晰顯示對應的短語文字**

---

### 【角色一致性規則】

* 不變項（所有格需保持一致）：臉型比例、膚色、髮型輪廓、主要服裝與配色
* 可變項（允許變化）：表情、眼睛形狀、嘴型、手勢與姿勢、小道具（符合主題）

---

### 【背景顏色要求（重要）】

背景必須是純色 **{BG_COLOR}**，用於後續去背處理。
不得出現場景、漸變、陰影或其他背景元素。

---

### 【最終目標】生成一張可直接按 {COLS}×{ROWS} 等分裁切的精靈圖。
`;

/**
 * Generate action suggestions based on phrase
 */
export const getActionHint = (phrase: string): string => {
    if (phrase.includes('成功') || phrase.includes('升級')) return '舉手慶祝、開心笑、比讚';
    if (phrase.includes('失敗') || phrase.includes('歸零')) return '垂頭喪氣、無奈表情、攤手';
    if (phrase.includes('查') || phrase.includes('規則')) return '翻書、思考、專注看書';
    if (phrase.includes('骰') || phrase.includes('檢定') || phrase.includes('暗骰')) return '丟骰子、緊張等待、看結果';
    if (phrase.includes('暴擊') || phrase.includes('攻擊')) return '揮拳、戰鬥姿勢、興奮表情';
    if (phrase.includes('技能')) return '施法手勢、出招姿勢、專注表情';
    if (phrase.includes('早安') || phrase.includes('晚安')) return '揮手、微笑、打招呼';
    if (phrase.includes('謝謝') || phrase.includes('不客氣')) return '鞠躬、點頭、友善微笑';
    if (phrase.includes('辛苦了') || phrase.includes('加油')) return '比讚、鼓勵手勢、溫暖笑容';
    if (phrase.includes('好累') || phrase.includes('累')) return '打哈欠、疲憊表情、擦汗';
    if (phrase.includes('開心') || phrase.includes('哈哈')) return '大笑、跳躍、比耶';
    if (phrase.includes('嗚嗚')) return '擦淚、委屈、哭哭表情';
    if (phrase.includes('咦')) return '歪頭、疑惑、問號表情';
    if (phrase.includes('收到') || phrase.includes('了解') || phrase.includes('OK')) return '點頭、OK手勢、確認表情';
    if (phrase === 'KKT' || phrase === 'KKO') return '滿懷期待地看向觀眾、可愛表情';
    return '符合語意的自然動作和表情';
};

export function buildLineStickerPrompt(
    slots: PromptSlots,
    cols: number,
    rows: number,
    bgColor: 'magenta' | 'green'
): string {
    const totalFrames = cols * rows;
    const bgColorText = bgColor === 'magenta' ? 'magenta #FF00FF' : 'green #00FF00';

    const characterSection = `### 【角色設定】\n* 描述：${slots.character.appearance}\n* 性格：${slots.character.personality}\n* 規則：${slots.character.originalImageRules}\n\n`;
    const styleSection = `### 【風格設定】\n* 風格：${slots.style.styleType}\n* 技法：${slots.style.drawingMethod}\n* 背景：${slots.style.background}\n\n`;

    const allPhrases = [...slots.theme.examplePhrases];
    if (slots.theme.specialStickers) allPhrases.push(...slots.theme.specialStickers.texts);

    const phrasesForFrames: string[] = [];
    for (let i = 0; i < totalFrames; i++) {
        phrasesForFrames.push(allPhrases.length > 0 ? allPhrases[i % allPhrases.length] : `表情 ${i + 1}`);
    }

    const themeSection = `### 【每一格的要求】\n${phrasesForFrames.map((phrase, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        return `**第 ${index + 1} 格 (${row}, ${col})**: "${phrase}" - ${getActionHint(phrase)}`;
    }).join('\n')}\n\n`;

    const textSection = `### 【文字設定】\n* 語言：${slots.text.language}\n* 風格：${slots.text.textStyle}\n* 顏色：${slots.text.textColor}\n`;

    const basePrompt = BASE_PROMPT.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{BG_COLOR}/g, bgColorText);

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
        styleType: 'Q 版（Chibi）、LINE 貼圖風格',
        drawingMethod: '彩色手繪風格，線條柔和',
        background: '純色背景，適用於 LINE 貼圖'
    },
    pixel: {
        label: '像素藝術',
        styleType: '16-bit 像素藝術風格 (Pixel Art)',
        drawingMethod: '明顯的像素顆粒，格狀繪圖法',
        background: '純色背景，強調像素邊緣'
    },
    minimalist: {
        label: '極簡線條',
        styleType: '極簡扁平插畫風格 (Minimalist Flat)',
        drawingMethod: '粗線條輪廓，色塊填充，無陰影',
        background: '乾淨的單色背景'
    },
    anime: {
        label: '日系動漫',
        styleType: '現代日系動漫精緻風格 (Modern Anime)',
        drawingMethod: '細膩的賽璐珞上色，層次感陰影',
        background: '單一淺色背景'
    },
    cartoon: {
        label: '美式卡通',
        styleType: '活力美式卡通風格 (Vibrant Cartoon)',
        drawingMethod: '粗黑外框線，鮮豔對比色',
        background: '飽和度高的純色背景'
    },
    watercolor: {
        label: '手繪水彩',
        styleType: '柔和水彩手繪風格 (Soft Watercolor)',
        drawingMethod: '水漬暈染感，透明感層次',
        background: '紙張質感底色或淡色背景'
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
