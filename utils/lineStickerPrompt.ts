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
    /** Text style / font (e.g., "手寫風格字體") */
    textStyle: string;
    /** Text color for prompt (e.g., "黑色 #000000") */
    textColor: string;
    /** Text length constraints */
    lengthConstraints: {
        chinese: string;
        english: string;
    };
}

/**
 * Text color options for sticker labels (default: black)
 */
export const TEXT_COLOR_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    black: {
        label: '黑色',
        promptDesc: '黑色 #000000',
    },
    white: {
        label: '白色',
        promptDesc: '白色 #FFFFFF',
    },
    darkGray: {
        label: '深灰',
        promptDesc: '深灰色 #333333',
    },
    navy: {
        label: '深藍',
        promptDesc: '深藍色 #1e3a5f',
    },
    darkRed: {
        label: '深紅',
        promptDesc: '深紅色 #8b0000',
    },
    brown: {
        label: '棕色',
        promptDesc: '棕色 #5c4033',
    },
};

/**
 * Font / text style options for sticker labels
 */
export const FONT_PRESETS: Record<string, { label: string; promptDesc: string }> = {
    handwritten: {
        label: '手寫風格',
        promptDesc: '手寫風格字體',
    },
    round: {
        label: '圓體',
        promptDesc: '圓潤可愛的圓體字',
    },
    bold: {
        label: '黑體',
        promptDesc: '清晰粗黑體',
    },
    cute: {
        label: '萌系',
        promptDesc: '萌系可愛字體',
    },
    pop: {
        label: '流行體',
        promptDesc: '流行活潑字體',
    },
};

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

生成一張 **可直接按 {COLS}×{ROWS} 等分裁切**、適合上架 LINE 貼圖平台的
**{TOTAL_FRAMES} 張 Q 版半身像貼圖精靈圖**。
* 整張圖為嚴格等分網格，無外圍留白、無格間空隙
* 每格內角色與文字盡量填滿，減少單格內空白
* 角色可愛、有情緒辨識度，文字實用、好聊天

---

`;

/**
 * Default Style Slot - Q版 LINE 貼圖風格 (kept for backward compatibility; use STYLE_PRESETS.chibi)
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
 * Style presets for sticker art (Style Slot). User can choose in UI.
 */
export const STYLE_PRESETS: Record<string, { label: string } & StyleSlot> = {
    chibi: {
        label: 'Q 版可愛',
        styleType: 'Q 版（Chibi）、LINE 貼圖風格、半身像為主',
        drawingMethod: `彩色手繪風格
  線條柔和、輪廓清楚、表情誇張但可愛
  適合在小尺寸手機畫面中清楚辨識`,
        background: `透明或單一淺色背景
  不得出現場景、格線、邊框、UI 元素`,
    },
    minimal: {
        label: '簡約線條',
        styleType: '簡約線條風格、極簡輪廓、半身或頭像為主',
        drawingMethod: `線條簡潔、少許色塊或留白
  輪廓明確、表情用簡單線條表現
  適合清爽、現代感的聊天貼圖`,
        background: `透明或單一淺色背景
  不得出現複雜場景、格線、邊框`,
    },
    watercolor: {
        label: '水彩手繪',
        styleType: '水彩手繪風格、半身像為主、筆觸可見',
        drawingMethod: `水彩暈染、邊緣可略帶暈開
  色彩柔和、筆觸自然
  保持在小尺寸下仍可辨識輪廓與表情`,
        background: `透明或單一淺色背景
  不得出現複雜場景、格線、邊框`,
    },
    pixel: {
        label: '像素風',
        styleType: '像素藝術（Pixel Art）、點陣風格、半身或頭像',
        drawingMethod: `明確的像素格、低解析度美感
  色塊分明、輪廓以像素呈現
  適合復古、遊戲感貼圖`,
        background: `透明或單一純色背景
  不得出現漸層、格線、邊框`,
    },
    flat: {
        label: '扁平插畫',
        styleType: '扁平化插畫（Flat design）、幾何色塊、半身像為主',
        drawingMethod: `無漸層、色塊分明、輪廓清晰
  造型略幾何化、表情明確
  適合現代、簡潔的 LINE 貼圖`,
        background: `透明或單一淺色背景
  不得出現立體陰影、複雜場景、格線`,
    },
    semiRealistic: {
        label: '半寫實',
        styleType: '半寫實風格、比例接近真人但略誇張、半身像為主',
        drawingMethod: `光影與五官較寫實、線條乾淨
  表情與動作可略誇張以利貼圖辨識
  適合偏成熟、質感型貼圖`,
        background: `透明或單一淺色背景
  不得出現複雜場景、格線、邊框`,
    },
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
 * Default Text Slot - 繁體中文, black text, handwritten font
 */
export const DEFAULT_TEXT_SLOT: TextSlot = {
    language: '繁體中文',
    textStyle: FONT_PRESETS.handwritten.promptDesc,
    textColor: TEXT_COLOR_PRESETS.black.promptDesc,
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
  * 將角色轉換為上述貼圖風格時，要保留原角色的核心特徵和辨識度

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
    
    // Generate action suggestions based on phrase (for prompt action hints)
    const getActionHint = (phrase: string): string => {
        if (phrase.includes('成功') || phrase.includes('升級')) {
            return '舉手慶祝、開心笑、比讚';
        } else if (phrase.includes('失敗') || phrase.includes('歸零')) {
            return '垂頭喪氣、無奈表情、攤手';
        } else if (phrase.includes('查') || phrase.includes('規則')) {
            return '翻書、思考、專注看書';
        } else if (phrase.includes('骰') || phrase.includes('檢定') || phrase.includes('暗骰')) {
            return '丟骰子、緊張等待、看結果';
        } else if (phrase.includes('暴擊') || phrase.includes('攻擊')) {
            return '揮拳、戰鬥姿勢、興奮表情';
        } else if (phrase.includes('技能')) {
            return '施法手勢、出招姿勢、專注表情';
        } else if (phrase.includes('經驗') || phrase.includes('寶物')) {
            return '驚喜表情、捧著寶物、開心笑';
        } else if (phrase.includes('復活')) {
            return '站起來、元氣滿滿、復活姿勢';
        } else if (phrase.includes('手下留情')) {
            return '雙手合十、拜託、懇求表情';
        } else if (phrase.includes('早安') || phrase.includes('晚安')) {
            return '揮手、微笑、打招呼';
        } else if (phrase.includes('謝謝') || phrase.includes('不客氣')) {
            return '鞠躬、點頭、友善微笑';
        } else if (phrase.includes('辛苦了') || phrase.includes('加油')) {
            return '比讚、鼓勵手勢、溫暖笑容';
        } else if (phrase.includes('好累') || phrase.includes('累')) {
            return '打哈欠、疲憊表情、擦汗';
        } else if (phrase.includes('開心') || phrase.includes('快樂') || phrase.includes('哈哈')) {
            return '大笑、跳躍、比耶';
        } else if (phrase.includes('嗚嗚')) {
            return '擦淚、委屈、哭哭表情';
        } else if (phrase.includes('咦')) {
            return '歪頭、疑惑、問號表情';
        } else if (phrase.includes('想你了')) {
            return '害羞、心形手勢、想念表情';
        } else if (phrase.includes('不要') || phrase.includes('等等')) {
            return '擺手、阻止手勢、著急表情';
        } else if (phrase.includes('收到') || phrase.includes('了解') || phrase.includes('已完成') || phrase.includes('OK') || phrase.includes('寄出') || phrase.includes('查收')) {
            return '點頭、OK手勢、確認表情';
        } else if (phrase.includes('稍等') || phrase.includes('進行中') || phrase.includes('開會') || phrase.includes('稍候')) {
            return '等待手勢、專注工作、思考';
        } else if (phrase.includes('明天見')) {
            return '揮手再見、微笑、道別';
        } else if (phrase.includes('交給我')) {
            return '拍胸脯、自信、可靠表情';
        } else if (phrase.includes('再確認')) {
            return '推眼鏡、認真、核對表情';
        } else if (phrase.includes('讚') || phrase.includes('推') || phrase.includes('分享') || phrase.includes('按讚')) {
            return '比讚、分享手勢、開心表情';
        } else if (phrase.includes('笑死') || phrase.includes('太神') || phrase.includes('跪了') || phrase.includes('神作')) {
            return '誇張笑、佩服、跪拜手勢';
        } else if (phrase.includes('愛了') || phrase.includes('必看') || phrase.includes('推爆')) {
            return '愛心手勢、推薦、興奮表情';
        } else if (phrase.includes('已讀')) {
            return '看手機、點頭、已讀表情';
        } else if (phrase.includes('收藏') || phrase.includes('訂閱')) {
            return '收藏手勢、開心、支持表情';
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
* 文字顏色：**${slots.text.textColor}**（所有短語文字統一使用此顏色）
* 文字長度：${slots.text.lengthConstraints.chinese}，${slots.text.lengthConstraints.english}
* **禁止**：長句、說明句、段落文字
${bgColor === 'magenta' ? `
* **去背友善（洋紅背景時必讀）**：
  背景為洋紅色 #FF00FF 時，為避免去背後文字或角色邊緣產生洋紅殘留：
  * 文字與角色輪廓**禁止使用**洋紅、粉紅、紫色或任何接近 #FF00FF 的顏色
  * 請使用與洋紅對比明顯的顏色（例如黑色、白色、深灰、深藍、深棕），且**不要**在文字或線條上做淡粉、淡紫的漸層或陰影
  * 這樣去背時才不會在文字處留下殘影` : ''}

---


`;

    // Build text section
    const textSection = `### 【文字與語言設定（Text Rules）】

* 字體風格：
  **${slots.text.textStyle}**

* 文字顏色：
  **${slots.text.textColor}**（所有貼圖上的短語文字皆使用此顏色）

* 文字語言：
  ${slots.text.language}

* 文字密度限制（必須遵守）：
  * ${slots.text.lengthConstraints.chinese}
  * ${slots.text.lengthConstraints.english}
  * 禁止長句、說明句、段落文字
${bgColor === 'magenta' ? `
* **去背友善**：背景為洋紅色時，文字與角色線條勿使用洋紅／粉紅／紫色，僅用與背景對比明顯的顏色，避免去背後文字處有殘留。` : ''}

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
 * Predefined theme slots for common use cases.
 * examplePhrases: 2-6 chars (Chinese), 1-3 words (English); ordered for variety when cycled in 4x6 grid.
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
            '我要攻擊！',
            '使用技能',
            '檢定失敗',
            '獲得經驗',
            '升級了！',
            '找到寶物',
            'HP 歸零',
            '復活！',
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
            '哈哈',
            '嗚嗚',
            '咦？',
            '嗯嗯',
            '好啊',
            '不要啦',
            '等等我',
            '想你了',
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
            '已讀',
            '笑死',
            '太神',
            '愛了',
            '必看',
            '推爆',
            '跪了',
            '神作',
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
            '再確認',
            '已寄出',
            '明天見',
            '開會中',
            '請稍候',
            '交給我',
            'OK',
            '請查收',
        ],
        specialStickers: {
            description: '角色 **滿懷期待地看向觀眾**',
            texts: ['KKT', 'KKO'],
        },
    },
};

/**
 * Predefined text slots for different languages (default black text, handwritten font)
 */
export const TEXT_PRESETS: Record<string, TextSlot> = {
    'zh-TW': {
        language: '繁體中文',
        textStyle: FONT_PRESETS.handwritten.promptDesc,
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
    'zh-CN': {
        language: '簡體中文',
        textStyle: FONT_PRESETS.handwritten.promptDesc,
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
    en: {
        language: 'English',
        textStyle: 'Hand-written style font',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
    ja: {
        language: '日本語',
        textStyle: '手書きスタイルフォント',
        textColor: TEXT_COLOR_PRESETS.black.promptDesc,
        lengthConstraints: {
            chinese: '建議 **2～6 個字**',
            english: '建議 **1～3 個單字**',
        },
    },
};
