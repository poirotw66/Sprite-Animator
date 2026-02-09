# LINE 貼圖 Prompt 插槽結構說明

## 📋 概述

本專案採用**模組化 Prompt 插槽結構**來生成 LINE 貼圖，將 prompt 拆分成多個獨立且可替換的插槽（Slots），讓您可以：

- ✅ **換主題不動結構**：更換聊天語境不影響核心生成邏輯
- ✅ **換語言不動表情邏輯**：更換文字語言不影響表情設計
- ✅ **換角色不影響貼圖品質**：更換角色描述不影響整體風格

---

## 🏗️ 插槽結構

### 1. Base（基礎結構）

**永遠不變的核心要求**，包含：

- 任務說明（生成 LINE 貼圖精靈圖）
- 精靈圖布局規則（4×6 網格、安全邊距等）
- 表情設計原則（單一明確情緒、表情+動作）
- 角色一致性規則（不變項 vs 可變項）
- LINE 貼圖實用性約束（小尺寸辨識度、禁止元素）
- 背景顏色要求

**位置**：`utils/lineStickerPrompt.ts` → `BASE_PROMPT`

---

### 2. Style Slot（畫風插槽）

**控制貼圖的視覺風格**，包含：

- 風格類型（Q版、LINE 貼圖風格、半身像）
- 繪畫方式（彩色手繪、線條柔和、表情誇張）
- 背景要求（透明或單一淺色）

**預設值**：`DEFAULT_STYLE_SLOT`

**位置**：`utils/lineStickerPrompt.ts`

**範例**：
```typescript
{
    styleType: 'Q 版（Chibi）、LINE 貼圖風格、半身像為主',
    drawingMethod: '彩色手繪風格\n線條柔和、輪廓清楚、表情誇張但可愛',
    background: '透明或單一淺色背景\n不得出現場景、格線、邊框、UI 元素'
}
```

---

### 3. Character Slot（角色插槽）

**描述角色的外觀與性格**，包含：

- 角色外觀描述（由使用者輸入或使用預設值）
- 角色氣質／性格關鍵字
- 原圖規則（不可直接複製、需重新設計）

**預設值**：`DEFAULT_CHARACTER_SLOT`

**位置**：`utils/lineStickerPrompt.ts`

**範例**：
```typescript
{
    appearance: '可愛、沉靜溫柔、有點小腹黑的人物形象',
    personality: '溫柔、呆萌、冷靜、害羞、可靠',
    originalImageRules: '❗ 不可直接複製、描摹或高度還原任何原圖\n❗ 僅可作為氣質與風格參考，需重新設計為原創角色'
}
```

**在 UI 中**：使用者可在「角色描述」欄位輸入自訂描述，留空則使用預設值。

---

### 4. Theme Slot（主題插槽）

**定義聊天語境與常用短語**，包含：

- 聊天主題／語境（如：TRPG 跑團、日常聊天、社群互動）
- 常用短語列表（每格貼圖對應的短語）
- 特殊貼圖需求（如：KKT、KKO 表情）

**預設主題**：`THEME_PRESETS`

**位置**：`utils/lineStickerPrompt.ts`

**可用主題**：
- `trpg`：TRPG 跑團（查規則書、骰子成功、暗骰中...）
- `daily`：日常聊天（早安、晚安、謝謝、辛苦了...）
- `social`：社群互動（讚、推、分享、轉發...）
- `workplace`：職場對話（收到、了解、已完成、進行中...）

**在 UI 中**：使用者可選擇預設主題，或輸入自訂短語（每行一句）來覆蓋預設短語。

**範例**：
```typescript
{
    chatContext: 'TRPG 跑團',
    examplePhrases: [
        '查規則書...',
        '骰子成功！',
        '暗骰中...',
        '暴擊！'
    ],
    specialStickers: {
        description: '角色 **滿懷期待地看向觀眾**',
        texts: ['KKT', 'KKO']
    }
}
```

---

### 5. Text Slot（文字插槽）

**控制文字語言與樣式**，包含：

- 文字語言（繁體中文、簡體中文、English、日本語）
- 文字樣式（手寫風格字體）
- 文字長度限制（中文 2-6 字、英文 1-3 單字）

**預設語言**：`TEXT_PRESETS`

**位置**：`utils/lineStickerPrompt.ts`

**可用語言**：
- `zh-TW`：繁體中文
- `zh-CN`：簡體中文
- `en`：English
- `ja`：日本語

**在 UI 中**：使用者可從下拉選單選擇文字語言。

**範例**：
```typescript
{
    language: '繁體中文',
    textStyle: '手寫風格字體',
    lengthConstraints: {
        chinese: '建議 **2～6 個字**',
        english: '建議 **1～3 個單字**'
    }
}
```

---

## 🔧 使用方式

### 在程式碼中使用

```typescript
import {
    buildLineStickerPrompt,
    DEFAULT_STYLE_SLOT,
    DEFAULT_CHARACTER_SLOT,
    THEME_PRESETS,
    TEXT_PRESETS,
    type PromptSlots,
} from '../utils/lineStickerPrompt';

// 組合所有插槽
const slots: PromptSlots = {
    style: DEFAULT_STYLE_SLOT,
    character: {
        ...DEFAULT_CHARACTER_SLOT,
        appearance: '自訂角色描述', // 覆蓋預設值
    },
    theme: THEME_PRESETS.trpg, // 或使用其他主題
    text: TEXT_PRESETS['zh-TW'], // 或使用其他語言
};

// 生成完整 prompt
const prompt = buildLineStickerPrompt(
    slots,
    4,  // cols
    6,  // rows
    'magenta' // bgColor: 'magenta' | 'green'
);
```

### 在 UI 中使用

1. **上傳角色圖片**
2. **輸入角色描述**（選填，留空使用預設）
3. **選擇聊天主題**（TRPG、日常、社群、職場）
4. **輸入自訂短語**（選填，每行一句，會覆蓋預設主題的短語）
5. **選擇文字語言**（繁體中文、簡體中文、English、日本語）
6. **設定網格大小**（4×6、3×8 等）
7. **選擇背景顏色**（洋紅色或綠色）
8. **點擊生成**

---

## 🎯 優勢

### 1. 模組化設計

每個插槽獨立運作，修改一個插槽不會影響其他插槽的邏輯。

### 2. 易於擴展

- **新增主題**：在 `THEME_PRESETS` 中添加新主題即可
- **新增語言**：在 `TEXT_PRESETS` 中添加新語言即可
- **修改風格**：修改 `DEFAULT_STYLE_SLOT` 即可

### 3. 產品化友好

未來可以：
- 讓使用者自訂主題並儲存
- 提供主題市場（使用者分享主題）
- 支援多語言切換不影響生成品質
- A/B 測試不同風格設定

---

## 📝 檔案結構

```
utils/
└── lineStickerPrompt.ts
    ├── BASE_PROMPT              # 基礎結構（永遠不變）
    ├── DEFAULT_STYLE_SLOT       # 預設畫風
    ├── DEFAULT_CHARACTER_SLOT   # 預設角色
    ├── DEFAULT_THEME_SLOT       # 預設主題
    ├── DEFAULT_TEXT_SLOT        # 預設文字
    ├── THEME_PRESETS            # 主題預設值
    ├── TEXT_PRESETS             # 語言預設值
    └── buildLineStickerPrompt() # 組合函數

pages/
└── LineStickerPage.tsx
    └── 使用插槽結構生成 prompt
```

---

## 🔄 更新歷史

- **v1.0.0**（2026-02-09）：初始版本，實現插槽結構
  - Base、Style、Character、Theme、Text 五個插槽
  - 支援 4 種預設主題
  - 支援 4 種語言

---

## 💡 未來擴展建議

1. **自訂主題儲存**：讓使用者儲存常用主題
2. **主題市場**：使用者分享與下載主題
3. **風格預設值**：提供多種畫風選項（寫實、卡通、像素等）
4. **角色模板**：提供常見角色類型模板
5. **批量生成**：一次生成多個主題的貼圖

---

## 📚 相關檔案

- `utils/lineStickerPrompt.ts`：Prompt 插槽結構實作
- `pages/LineStickerPage.tsx`：UI 整合
- `services/geminiService.ts`：AI 圖像生成服務
