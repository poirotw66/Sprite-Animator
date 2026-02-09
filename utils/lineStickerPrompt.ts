/**
 * LINE Sticker Prompt Structure
 * 
 * This file implements a modular prompt system with slots:
 * - Base: Core requirements that never change
 * - Style Slot: Art style and visual approach
 * - Character Slot: Character appearance and personality
 * - Theme Slot: Chat context and use cases
 * - Text Slot: Language and text content
 * 
 * This structure allows:
 * - Changing themes without affecting structure
 * - Changing languages without affecting expression logic
 * - Changing characters without affecting sticker quality
 */

export interface PromptSlots {
    style: StyleSlot;
    character: CharacterSlot;
    theme: ThemeSlot;
    text: TextSlot;
}

export interface StyleSlot {
    /** Art style type (e.g., "Q版 (Chibi)", "LINE 貼圖風格") */
    styleType: string;
    /** Drawing method description */
    drawingMethod: string;
    /** Background requirements */
    background: string;
}

export interface CharacterSlot {
    /** Character appearance description */
    appearance: string;
    /** Character personality/traits keywords */
    personality: string;
    /** Original image rules */
    originalImageRules: string;
}

export interface ThemeSlot {
    /** Chat context/use case (e.g., "TRPG 跑團", "日常聊天") */
    chatContext: string;
    /** List of example phrases for this theme */
    examplePhrases: string[];
    /** Special sticker requirements */
    specialStickers?: {
        description: string;
        texts: string[];
    };
}

export interface TextSlot {
    /** Text language (e.g., "繁體中文", "English") */
    language: string;
    /** Text style requirements */
    textStyle: string;
    /** Text length constraints */
    lengthConstraints: {
        chinese: string;
        english: string;
    };
}

/**
 * Base Prompt - Core requirements that never change
 * This is the foundation structure for LINE sticker generation
 */
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

### 【精靈圖布局（Sprite Sheet Layout）】

* 布局規格：
  **{COLS} × {ROWS} 網格（共 {TOTAL_FRAMES} 格）**

* 布局規則（嚴格遵守）：
  * 每一格 = 一張可獨立使用的 LINE 貼圖
  * 角色與文字 **不得跨越格線或接觸相鄰格子**
  * 每格需保留安全邊距，避免後續裁切到臉或文字
  * 不可顯示任何分隔線或格線

---

### 【表情設計原則（非常重要）】

* 每一格貼圖需對應 **單一、明確的情緒**
* **每一格的動作、表情、文字都必須不同**，絕對不能重複
* 即使不看文字，也能從表情與動作大致理解情緒
* 表情需包含：
  臉部表情＋肢體動作（如手勢、姿勢、道具）
* **每一格都必須在貼圖上清晰顯示對應的短語文字**

---

### 【角色一致性規則】

* 不變項（所有格需保持一致）：
  * 臉型比例
  * 膚色
  * 髮型輪廓
  * 主要服裝與配色

* 可變項（允許變化）：
  * 表情
  * 眼睛形狀
  * 嘴型
  * 手勢與姿勢
  * 小道具（符合主題）

---

### 【LINE 貼圖實用性約束】

* 每一格貼圖需在 **小尺寸顯示（約 96×96）** 下仍能清楚辨識
* 表情與文字需清楚、有辨識度
* 禁止出現：
  ❌ 水印
  ❌ 編號
  ❌ 簽名
  ❌ UI 或介面元素

---

### 【背景顏色要求（重要）】

背景必須是純色 **{BG_COLOR}**，用於後續去背處理。
不得出現場景、漸變、陰影或其他背景元素。

---

### 【最終目標】

生成一張可直接拆分、適合上架 LINE 貼圖平台的
**{TOTAL_FRAMES} 張 Q 版半身像貼圖精靈圖**，
角色可愛、有情緒辨識度，文字實用、好聊天。

---

`;

/**
 * Default Style Slot - Q版 LINE 貼圖風格
 */
export const DEFAULT_STYLE_SLOT: StyleSlot = {
    styleType: 'Q 版（Chibi）、LINE 貼圖風格、半身像為主',
    drawingMethod: `彩色手繪風格
  線條柔和、輪廓清楚、表情誇張但可愛
  適合在小尺寸手機畫面中清楚辨識`,
    background: `透明或單一淺色背景
  不得出現場景、格線、邊框、UI 元素`,
};

/**
 * Default Character Slot
 */
export const DEFAULT_CHARACTER_SLOT: CharacterSlot = {
    appearance: '可愛、沉靜溫柔、有點小腹黑的人物形象',
    personality: '溫柔、呆萌、冷靜、害羞、可靠',
    originalImageRules: `❗ 不可直接複製、描摹或高度還原任何原圖
  ❗ 僅可作為氣質與風格參考，需重新設計為原創角色`,
};

/**
 * Default Theme Slot - TRPG 跑團主題
 */
export const DEFAULT_THEME_SLOT: ThemeSlot = {
    chatContext: 'TRPG 跑團',
    examplePhrases: [
        '查規則書...',
        '骰子成功！',
        '暗骰中...',
        '暴擊！',
        '大失敗...',
        'GM 手下留情',
        '先攻檢定！',
        '豁免檢定！',
    ],
    specialStickers: {
        description: '角色 **滿懷期待地看向觀眾**',
        texts: ['KKT', 'KKO'],
    },
};

/**
 * Default Text Slot - 繁體中文
 */
export const DEFAULT_TEXT_SLOT: TextSlot = {
    language: '繁體中文',
    textStyle: '手寫風格字體',
    lengthConstraints: {
        chinese: '建議 **2～6 個字**',
        english: '建議 **1～3 個單字**',
    },
};

/**
 * Build the complete prompt by combining all slots
 */
export function buildLineStickerPrompt(
    slots: PromptSlots,
    cols: number,
    rows: number,
    bgColor: 'magenta' | 'green'
): string {
    const totalFrames = cols * rows;
    const bgColorText = bgColor === 'magenta' ? 'magenta #FF00FF' : 'green #00FF00';

    // Build character section
    const characterSection = `### 【角色設定（Character）】

* **角色參考來源**：
  請參考使用者上傳的圖片中的角色設計，保持角色的基本特徵和辨識度。

* 角色外觀描述（補充說明）：
  ${slots.character.appearance}
  （如果使用者上傳的圖片與此描述不同，請以圖片為準）

* 角色氣質／性格關鍵字：
  ${slots.character.personality}

* 原圖規則（重要）：
  ${slots.character.originalImageRules}
  * 請仔細觀察使用者上傳的圖片，理解角色的設計風格、配色、髮型、服裝等特徵
  * 將角色轉換為 Q 版風格時，要保留原角色的核心特徵和辨識度

---

`;

    // Build style section
    const styleSection = `### 【貼圖繪製風格（Sticker Art Style）】

* 風格類型：
  ${slots.style.styleType}

* 繪畫方式：
  ${slots.style.drawingMethod}

* 背景：
  ${slots.style.background}

---

`;

    // Build theme section with explicit frame-to-phrase mapping
    const allPhrases = [...slots.theme.examplePhrases];
    if (slots.theme.specialStickers) {
        allPhrases.push(...slots.theme.specialStickers.texts);
    }
    
    // Ensure we have enough phrases for all frames (cycle if needed)
    const phrasesForFrames: string[] = [];
    for (let i = 0; i < totalFrames; i++) {
        if (allPhrases.length > 0) {
            phrasesForFrames.push(allPhrases[i % allPhrases.length]);
        } else {
            // Fallback if no phrases provided
            phrasesForFrames.push(`表情 ${i + 1}`);
        }
    }
    
    // Generate action suggestions based on phrase
    const getActionHint = (phrase: string): string => {
        if (phrase.includes('成功') || phrase.includes('成功')) {
            return '舉手慶祝、開心笑、比讚';
        } else if (phrase.includes('失敗') || phrase.includes('失敗')) {
            return '垂頭喪氣、無奈表情、攤手';
        } else if (phrase.includes('查') || phrase.includes('檢查') || phrase.includes('規則')) {
            return '翻書、思考、專注看書';
        } else if (phrase.includes('骰') || phrase.includes('檢定') || phrase.includes('暗骰')) {
            return '丟骰子、緊張等待、看結果';
        } else if (phrase.includes('暴擊') || phrase.includes('攻擊')) {
            return '揮拳、戰鬥姿勢、興奮表情';
        } else if (phrase.includes('早安') || phrase.includes('晚安')) {
            return '揮手、微笑、打招呼';
        } else if (phrase.includes('謝謝') || phrase.includes('不客氣')) {
            return '鞠躬、點頭、友善微笑';
        } else if (phrase.includes('辛苦了') || phrase.includes('加油')) {
            return '比讚、鼓勵手勢、溫暖笑容';
        } else if (phrase.includes('好累') || phrase.includes('累')) {
            return '打哈欠、疲憊表情、擦汗';
        } else if (phrase.includes('開心') || phrase.includes('快樂')) {
            return '大笑、跳躍、比耶';
        } else if (phrase.includes('收到') || phrase.includes('了解') || phrase.includes('已完成')) {
            return '點頭、OK手勢、確認表情';
        } else if (phrase.includes('稍等') || phrase.includes('進行中')) {
            return '等待手勢、專注工作、思考';
        } else if (phrase.includes('讚') || phrase.includes('推') || phrase.includes('分享')) {
            return '比讚、分享手勢、開心表情';
        } else if (phrase === 'KKT' || phrase === 'KKO') {
            return '滿懷期待地看向觀眾、可愛表情';
        }
        return '符合語意的自然動作和表情';
    };

    const themeSection = `### 【表情主題與文字內容（Theme）】

* 聊天主題／語境：
  ${slots.theme.chatContext}

---

### 【重要：每一格的具體要求（CRITICAL）】

**每一格貼圖都必須包含以下三個要素，缺一不可：**

1. **角色動作和表情**：根據短語語意做出對應的動作和表情
2. **短語文字**：必須在貼圖上清晰顯示對應的短語文字（${slots.text.textStyle}，${slots.text.language}）
3. **獨特性**：每一格的動作、表情、文字都必須不同

---

### 【每一格的具體分配（按順序）】

請按照以下順序，從左上角開始，從左到右、從上到下，為每一格分配對應的短語和動作：

${phrasesForFrames.map((phrase, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        const actionHint = getActionHint(phrase);
        const isSpecial = slots.theme.specialStickers?.texts.includes(phrase);
        
        return `**第 ${index + 1} 格（第 ${row} 行第 ${col} 列）**：
  * 短語文字：**"${phrase}"**（必須清晰顯示在貼圖上，${slots.text.textStyle}）
  * 角色動作：${actionHint}
  * 表情要求：符合「${phrase}」的語意和情緒
  ${isSpecial ? `* 特殊要求：${slots.theme.specialStickers?.description}` : ''}
`;
    }).join('\n')}

---

### 【動作設計原則（必須遵守）】

* **每一格必須是不同的動作**：絕對不能重複相同的動作或姿勢
* **即使短語相同，動作也必須不同**：如果同一短語出現在多格，每格必須使用不同的動作變體
* **動作要符合語意**：每個短語都有其語意和情境，角色必須做出符合該語意的動作
* **動作要自然、誇張但可愛**：符合 Q 版風格，適合小尺寸顯示
* **動作變化範例**（同一短語的不同動作變體）：
  * 「成功」第 1 次 → 舉手慶祝、開心笑
  * 「成功」第 2 次 → 比讚、跳躍
  * 「成功」第 3 次 → 雙手高舉、大笑
  * 「查規則」第 1 次 → 翻書、思考
  * 「查規則」第 2 次 → 專注看書、推眼鏡
  * 「查規則」第 3 次 → 指著書本、恍然大悟

---

### 【文字顯示要求（CRITICAL）】

* **每一格都必須顯示對應的短語文字**
* 文字必須清晰可見，使用 ${slots.text.textStyle}
* 文字語言：${slots.text.language}
* 文字位置：可以放在角色旁邊、上方、下方，但不能遮擋角色的臉部
* 文字大小：要足夠大，在小尺寸（96×96）下仍能清楚辨識
* 文字顏色：要與背景和角色形成對比，確保清晰可讀
* 文字長度：${slots.text.lengthConstraints.chinese}，${slots.text.lengthConstraints.english}
* **禁止**：長句、說明句、段落文字

---


`;

    // Build text section
    const textSection = `### 【文字與語言設定（Text Rules）】

* 所有文字皆需：
  **${slots.text.textStyle}**

* 文字語言：
  ${slots.text.language}

* 文字密度限制（必須遵守）：
  * ${slots.text.lengthConstraints.chinese}
  * ${slots.text.lengthConstraints.english}
  * 禁止長句、說明句、段落文字

---

`;

    // Replace placeholders in base prompt
    const basePrompt = BASE_PROMPT.replace(/{TOTAL_FRAMES}/g, totalFrames.toString())
        .replace(/{COLS}/g, cols.toString())
        .replace(/{ROWS}/g, rows.toString())
        .replace(/{BG_COLOR}/g, bgColorText);

    // Combine all sections
    return `${basePrompt}${characterSection}${styleSection}${themeSection}${textSection}`;
}

/**
 * Predefined theme slots for common use cases
 */
export const THEME_PRESETS: Record<string, ThemeSlot> = {
    trpg: {
        chatContext: 'TRPG 跑團',
        examplePhrases: [
            '查規則書...',
            '骰子成功！',
            '暗骰中...',
            '暴擊！',
            '大失敗...',
            'GM 手下留情',
            '先攻檢定！',
            '豁免檢定！',
        ],
        specialStickers: {
            description: '角色 **滿懷期待地看向觀眾**',
            texts: ['KKT', 'KKO'],
        },
    },
    daily: {
        chatContext: '日常聊天',
        examplePhrases: [
            '早安',
            '晚安',
            '謝謝',
            '不客氣',
            '辛苦了',
            '加油',
            '好累',
            '開心',
        ],
        specialStickers: {
            description: '角色 **滿懷期待地看向觀眾**',
            texts: ['KKT', 'KKO'],
        },
    },
    social: {
        chatContext: '社群互動',
        examplePhrases: [
            '讚',
            '推',
            '分享',
            '轉發',
            '收藏',
            '訂閱',
            '按讚',
            '留言',
        ],
        specialStickers: {
            description: '角色 **滿懷期待地看向觀眾**',
            texts: ['KKT', 'KKO'],
        },
    },
    workplace: {
        chatContext: '職場對話',
        examplePhrases: [
            '收到',
            '了解',
            '已完成',
            '進行中',
            '稍等',
            '沒問題',
            '辛苦了',
            '謝謝',
        ],
        specialStickers: {
            description: '角色 **滿懷期待地看向觀眾**',
            texts: ['KKT', 'KKO'],
        },
    },
};

/**
 * Predefined text slots for different languages
 */
export const TEXT_PRESETS: Record<string, TextSlot> = {
    'zh-TW': {
        language: '繁體中文',
        textStyle: '手寫風格字體',
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
    'zh-CN': {
        language: '簡體中文',
        textStyle: '手寫風格字體',
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
    en: {
        language: 'English',
        textStyle: 'Hand-written style font',
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
    ja: {
        language: '日本語',
        textStyle: '手書きスタイルフォント',
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
};
