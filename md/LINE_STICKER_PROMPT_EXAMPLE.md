# LINE 貼圖 Prompt 使用範例

## 📝 基本使用

### 範例 1：使用預設設定生成日常聊天主題貼圖

```typescript
import {
    buildLineStickerPrompt,
    DEFAULT_STYLE_SLOT,
    DEFAULT_CHARACTER_SLOT,
    THEME_PRESETS,
    TEXT_PRESETS,
} from '../utils/lineStickerPrompt';

const slots = {
    style: DEFAULT_STYLE_SLOT,
    character: DEFAULT_CHARACTER_SLOT,
    theme: THEME_PRESETS.daily,
    text: TEXT_PRESETS['zh-TW'],
};

const prompt = buildLineStickerPrompt(slots, 4, 6, 'magenta');
console.log(prompt);
```

**輸出**：生成一個 4×6 網格（24 格）的日常聊天主題貼圖 prompt，使用繁體中文，背景為洋紅色。

---

### 範例 2：自訂角色描述

```typescript
const slots = {
    style: DEFAULT_STYLE_SLOT,
    character: {
        ...DEFAULT_CHARACTER_SLOT,
        appearance: '活潑開朗、喜歡運動的陽光女孩，短髮、穿著運動服',
        personality: '開朗、活潑、熱情、積極、樂觀',
    },
    theme: THEME_PRESETS.daily,
    text: TEXT_PRESETS['zh-TW'],
};

const prompt = buildLineStickerPrompt(slots, 3, 8, 'green');
```

**輸出**：生成一個 3×8 網格（24 格）的日常聊天主題貼圖 prompt，角色為陽光女孩，背景為綠色。

---

### 範例 3：自訂主題短語

```typescript
const slots = {
    style: DEFAULT_STYLE_SLOT,
    character: DEFAULT_CHARACTER_SLOT,
    theme: {
        ...THEME_PRESETS.daily,
        examplePhrases: [
            '我要攻擊！',
            '使用技能',
            '檢定失敗',
            '獲得經驗值',
            '升級了！',
            '找到寶物',
            'HP 歸零',
            '復活！',
        ],
    },
    text: TEXT_PRESETS['zh-TW'],
};

const prompt = buildLineStickerPrompt(slots, 4, 6, 'magenta');
```

**輸出**：使用自訂的日常短語列表生成貼圖。

---

### 範例 4：英文貼圖

```typescript
const slots = {
    style: DEFAULT_STYLE_SLOT,
    character: DEFAULT_CHARACTER_SLOT,
    theme: {
        chatContext: 'Daily Chat',
        examplePhrases: [
            'Good morning',
            'Good night',
            'Thank you',
            'You\'re welcome',
            'Well done',
            'Good luck',
            'So tired',
            'Happy',
        ],
        specialStickers: {
            description: 'Character **looking expectantly at the viewer**',
            texts: ['KKT', 'KKO'],
        },
    },
    text: TEXT_PRESETS.en,
};

const prompt = buildLineStickerPrompt(slots, 4, 6, 'magenta');
```

**輸出**：生成英文貼圖 prompt。

---

### 範例 5：職場主題 + 簡體中文

```typescript
const slots = {
    style: DEFAULT_STYLE_SLOT,
    character: {
        ...DEFAULT_CHARACTER_SLOT,
        appearance: '專業、幹練的職場人士，穿著西裝',
        personality: '專業、可靠、認真、負責、友善',
    },
    theme: THEME_PRESETS.workplace,
    text: TEXT_PRESETS['zh-CN'],
};

const prompt = buildLineStickerPrompt(slots, 4, 6, 'magenta');
```

**輸出**：生成職場主題的簡體中文貼圖。

---

## 🎨 完整 Prompt 輸出範例

以下是使用預設設定生成的完整 prompt（4×6 網格，日常聊天主題，繁體中文）：

```
🎨 LINE 貼圖精靈圖生成【完整 Prompt】

### 【任務說明】

請繪製一張 **LINE 貼圖用的精靈圖（Sprite Sheet）**，
內容為同一位角色的 **24 個 Q 版半身像表情貼圖**，
以 **4 × 6 網格布局** 排列，每一格皆可獨立拆分成單一 LINE 貼圖使用。

---

### 【精靈圖布局（Sprite Sheet Layout）】

* 布局規格：
  **4 × 6 網格（共 24 格）**

* 布局規則（嚴格遵守）：
  * 每一格 = 一張可獨立使用的 LINE 貼圖
  * 角色與文字 **不得跨越格線或接觸相鄰格子**
  * 每格需保留安全邊距，避免後續裁切到臉或文字
  * 不可顯示任何分隔線或格線

---

### 【表情設計原則（非常重要）】

* 每一格貼圖需對應 **單一、明確的情緒**
* 即使不看文字，也能從表情與動作大致理解情緒
* 表情需包含：
  臉部表情＋肢體動作（如手勢、姿勢、道具）

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

背景必須是純色 **magenta #FF00FF**，用於後續去背處理。
不得出現場景、漸變、陰影或其他背景元素。

---

### 【最終目標】

生成一張可直接拆分、適合上架 LINE 貼圖平台的
**24 張 Q 版半身像貼圖精靈圖**，
角色可愛、有情緒辨識度，文字實用、好聊天。

---

### 【角色設定（Character）】

* 角色外觀描述：
  可愛、沉靜溫柔、有點小腹黑的人物形象

* 角色氣質／性格關鍵字：
  溫柔、呆萌、冷靜、害羞、可靠

* 原圖規則（重要）：
  ❗ 不可直接複製、描摹或高度還原任何原圖
  ❗ 僅可作為氣質與風格參考，需重新設計為原創角色

---

### 【貼圖繪製風格（Sticker Art Style）】

* 風格類型：
  Q 版（Chibi）、LINE 貼圖風格、半身像為主

* 繪畫方式：
  彩色手繪風格
  線條柔和、輪廓清楚、表情誇張但可愛
  適合在小尺寸手機畫面中清楚辨識

* 背景：
  透明或單一淺色背景
  不得出現場景、格線、邊框、UI 元素

---

### 【表情主題與文字內容（Theme）】

* 聊天主題／語境：
  日常聊天

* 每格貼圖包含：
  * 對應該語境的自然情緒
  * 一句適合聊天使用的短文字

* 文字內容來源：
  - "查規則書..."
  - "骰子成功！"
  - "暗骰中..."
  - "暴擊！"
  - "大失敗..."
  - "GM 手下留情"
  - "先攻檢定！"
  - "豁免檢定！"

* 特殊貼圖（固定需求）：
  包含 **2 格特殊表情貼圖**：
  * 表情描述：角色 **滿懷期待地看向觀眾**
  * 文字內容（萌系、手寫風格）：
    * "KKT"
    * "KKO"

---

### 【文字與語言設定（Text Rules）】

* 所有文字皆需：
  **手寫風格字體**

* 文字語言：
  繁體中文

* 文字密度限制（必須遵守）：
  * 建議 **2～6 個字**
  * 建議 **1～3 個單字**
  * 禁止長句、說明句、段落文字

---

```

---

## 🔧 進階使用

### 動態生成多個主題

```typescript
const themes = ['daily', 'social', 'workplace'];
const languages = ['zh-TW', 'en', 'ja'];

themes.forEach((themeKey) => {
    languages.forEach((langKey) => {
        const slots = {
            style: DEFAULT_STYLE_SLOT,
            character: DEFAULT_CHARACTER_SLOT,
            theme: THEME_PRESETS[themeKey],
            text: TEXT_PRESETS[langKey],
        };
        
        const prompt = buildLineStickerPrompt(slots, 4, 6, 'magenta');
        // 儲存或使用 prompt...
    });
});
```

---

### 從使用者輸入建立 Prompt

```typescript
function createPromptFromUserInput(
    characterDesc: string,
    themeKey: string,
    customPhrases: string[],
    langKey: string,
    cols: number,
    rows: number
) {
    const slots = {
        style: DEFAULT_STYLE_SLOT,
        character: characterDesc
            ? {
                  ...DEFAULT_CHARACTER_SLOT,
                  appearance: characterDesc,
              }
            : DEFAULT_CHARACTER_SLOT,
        theme: customPhrases.length > 0
            ? {
                  ...THEME_PRESETS[themeKey],
                  examplePhrases: customPhrases,
              }
            : THEME_PRESETS[themeKey],
        text: TEXT_PRESETS[langKey],
    };
    
    return buildLineStickerPrompt(slots, cols, rows, 'magenta');
}
```

---

## 📚 相關文件

- [LINE_STICKER_PROMPT_STRUCTURE.md](./LINE_STICKER_PROMPT_STRUCTURE.md)：詳細的插槽結構說明
- `utils/lineStickerPrompt.ts`：實作程式碼
