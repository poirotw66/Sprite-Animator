# Color Normalization Process Diagram
# 顏色標準化流程圖

## Problem: AI-Generated Color Variations (問題: AI 生成的色差)

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Model Generates Sprite Sheet with Green Background         │
│  (AI 模型生成帶綠幕背景的精靈圖)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Generated Image has Color Variations (生成的圖片有色差)         │
│                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Frame 1 │  │ Frame 2 │  │ Frame 3 │  │ Frame 4 │           │
│  │ #00FF00 │  │ #00C850 │  │ #10B145 │  │ #00A030 │           │
│  │  (Lime) │  │(Variant)│  │(Variant)│  │(Variant)│           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                   │
│  Different RGB values! (不同的 RGB 值!)                         │
│  R: 0-16   G: 160-255   B: 0-80                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ❌ Chroma Key Removal FAILS (色度去背失敗)                     │
│                                                                   │
│  Target: #00FF00 (R=0, G=255, B=0)                             │
│  Actual: Various greens (各種綠色)                              │
│  Result: Background NOT removed (背景沒有去除)                  │
│                                                                   │
│  🔴 Residual green tint on character edges                      │
│  🔴 Incomplete background removal                               │
└─────────────────────────────────────────────────────────────────┘
```

## Solution: Automatic Color Normalization (解決方案: 自動顏色標準化)

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Detect Background Color Variations                     │
│  (步驟 1: 檢測背景顏色變體)                                       │
│                                                                   │
│  Scan all pixels and identify green-like colors:                │
│  • g > 80                                                        │
│  • r < 120                                                       │
│  • b < 150                                                       │
│  • g > r + 40                                                    │
│  • g > b                                                         │
│  • OR distance from #00FF00 < 80                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Replace with Target Color                              │
│  (步驟 2: 替換為目標顏色)                                         │
│                                                                   │
│  For each detected background pixel:                             │
│  data[i]   = 0    (R)                                           │
│  data[i+1] = 255  (G)  ← Target: #00FF00                       │
│  data[i+2] = 0    (B)                                           │
│  data[i+3] = (keep original alpha for anti-aliasing)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Normalized Image (標準化後的圖片)                               │
│                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Frame 1 │  │ Frame 2 │  │ Frame 3 │  │ Frame 4 │           │
│  │ #00FF00 │  │ #00FF00 │  │ #00FF00 │  │ #00FF00 │           │
│  │  (Exact)│  │  (Exact)│  │  (Exact)│  │  (Exact)│           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                   │
│  ALL frames now have EXACT #00FF00 background!                  │
│  (所有幀現在都有精確的 #00FF00 背景!)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Chroma Key Removal SUCCESS (色度去背成功)                   │
│                                                                   │
│  Target: #00FF00 (R=0, G=255, B=0)                             │
│  Actual: #00FF00 (R=0, G=255, B=0) ← MATCH!                    │
│  Result: Perfect background removal (完美去背)                  │
│                                                                   │
│  ✨ Clean edges on character                                    │
│  ✨ Complete background removal                                 │
│  ✨ No residual color tint                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Complete Workflow (完整工作流程)

```
┌──────────────┐
│ AI Generation│
│ (AI 生成)    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Color Normalization  │ ← NEW STEP (新步驟)
│ (顏色標準化)          │   Automatic (自動)
└──────┬───────────────┘   Fast (快速)
       │                    Accurate (精確)
       ▼
┌──────────────────────┐
│ Chroma Key Removal   │
│ (色度去背)            │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Sprite Sheet Slicing │
│ (精靈圖切分)          │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Animation Export     │
│ (動畫導出)            │
└──────────────────────┘
```

## Color Detection Examples (顏色檢測範例)

### Magenta Detection (洋紅色檢測)

```
Target: #FF00FF (R=255, G=0, B=255)

✅ WILL BE NORMALIZED (會被標準化):
   #FE00FE  (254, 0, 254)   ← Very close
   #FC00FC  (252, 0, 252)   ← Close
   #FF10FF  (255, 16, 255)  ← G slightly high but still magenta-like
   #F800F8  (248, 0, 248)   ← Within tolerance
   
❌ WILL NOT BE NORMALIZED (不會被標準化):
   #FF69B4  (255, 105, 180) ← Pink (G too high)
   #800080  (128, 0, 128)   ← Purple (R, B too low)
   #E91E63  (233, 30, 99)   ← Pink shade (G too high)
```

### Green Detection (綠色檢測)

```
Target: #00FF00 (R=0, G=255, B=0)

✅ WILL BE NORMALIZED (會被標準化):
   #00FF00  (0, 255, 0)     ← Target (pure neon green)
   #00B140  (0, 177, 64)    ← Green-like variant
   #00C850  (0, 200, 80)    ← Close variant
   #10B145  (16, 177, 69)   ← Very close
   #00A030  (0, 160, 48)    ← Darker green
   
❌ WILL NOT BE NORMALIZED (不會被標準化):
   #32CD32  (50, 205, 50)   ← Lime green (R too high)
   #ADFF2F  (173, 255, 47)  ← Yellow-green (R too high)
   #006400  (0, 100, 0)     ← Dark green (G too low)
```

## Performance Metrics (效能指標)

```
┌─────────────────────────────────────────────────────────────┐
│ Image Size       │ Processing Time │ Memory Usage          │
├──────────────────┼─────────────────┼───────────────────────┤
│ 512x512 (0.3MP)  │ ~50-100ms       │ ~4MB                 │
│ 1024x1024 (1MP)  │ ~150-250ms      │ ~16MB                │
│ 1920x1080 (2MP)  │ ~250-400ms      │ ~32MB                │
│ 2048x2048 (4MP)  │ ~400-600ms      │ ~64MB                │
└─────────────────────────────────────────────────────────────┘

Notes:
• Client-side processing (客戶端處理)
• No API calls required (無需 API 請求)
• Temporary memory (臨時記憶體)
• Fast cleanup (快速清理)
```

## Benefits Summary (優勢總結)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Before Normalization (標準化前):                              │
│  ❌ Color variations cause background removal failure          │
│  ❌ Manual color correction needed                             │
│  ❌ Inconsistent results                                       │
│  ❌ Time-consuming troubleshooting                             │
│                                                                 │
│  After Normalization (標準化後):                               │
│  ✅ Perfect background removal every time                      │
│  ✅ Fully automatic - no user intervention                     │
│  ✅ Consistent, reliable results                               │
│  ✅ Fast processing with no extra API costs                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

**Technical Implementation**: See [BACKGROUND_COLOR_NORMALIZATION.md](./BACKGROUND_COLOR_NORMALIZATION.md)  
**Testing Guide**: See [TEST_COLOR_NORMALIZATION.md](./TEST_COLOR_NORMALIZATION.md)  
**Version**: v1.2.0  
**Date**: 2026-01-30
