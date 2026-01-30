# Background Color Normalization (背景顏色標準化)

## Problem (問題)

AI 模型生成的綠幕/洋紅色背景往往與標準色度去背色不完全一致,導致去背效果不佳。

### Examples of Color Variations (色差範例)

**Magenta (洋紅色):**
- Target: `#FF00FF` (R=255, G=0, B=255)
- AI might generate: `#FE00FE`, `#FC00FC`, `#FF10FF`, `#F800F8`
- Even small differences cause chroma key removal to fail

**Green Screen (綠幕):**
- Target: `#00B140` (R=0, G=177, B=64)
- AI might generate: `#00FF00`, `#00C850`, `#10B145`, `#00A030`
- Color variations prevent proper background removal

## Solution (解決方案)

### 1. Color Normalization Post-Processing (顏色標準化後處理)

After receiving the AI-generated image, we automatically normalize the background color:

```typescript
async function normalizeBackgroundColor(
    base64Image: string,
    targetColor: { r: number; g: number; b: number },
    colorType: ChromaKeyColorType
): Promise<string>
```

**Process (處理流程):**

1. **Detect background pixels (檢測背景像素)**
   - For magenta: High R, Low G, High B
   - For green: Low R, High G, Low-medium B
   - Use permissive tolerance (80 units) for detection

2. **Replace with exact color (替換為精確顏色)**
   - All detected background pixels → Exact target RGB
   - Preserves alpha channel for anti-aliasing edges

3. **Result (結果)**
   - Consistent background color across entire image
   - Perfect chroma key removal compatibility

### 2. Enhanced Prompt Engineering (強化提示詞)

We provide explicit color specifications to the AI model:

**Magenta Prompt:**
```
✅ CORRECT: Pure magenta #FF00FF - R=255, G=0, B=255
❌ WRONG: Pink (#FF69B4), Purple (#800080), Hot Pink (#FF1493)
Visual Check: Electric magenta that hurts your eyes - NOT soft pink
```

**Green Screen Prompt:**
```
✅ CORRECT: Standard green screen #00B140 - R=0, G=177, B=64
❌ WRONG: Lime (#00FF00), Forest Green (#228B22), Neon Green (#39FF14)
Visual Check: Professional video green screen - NOT lime or grass green
```

## Technical Details (技術細節)

### Detection Tolerance (檢測容差)

```typescript
// Normalization (more permissive)
const tolerance = 80; // For detecting similar colors

// Chroma Key Removal (after normalization)
const fuzz = 25; // 25% tolerance for final removal
```

### Color Detection Logic (顏色檢測邏輯)

**Magenta Detection:**
```typescript
const isMagentaLike = (
    r > 150 && b > 150 && g < 120 &&     // Basic magenta shape
    (r + b) > (g * 2.5) &&                // R+B much higher than G
    Math.abs(r - b) < 100                 // R and B are similar
);
```

**Green Detection:**
```typescript
const isGreenLike = (
    g > 80 &&           // Minimum green intensity
    r < 120 &&          // Low red
    b < 150 &&          // Low to medium blue
    g > r + 40 &&       // Green significantly higher than red
    g > b               // Green higher than blue
);
```

## Benefits (優勢)

1. **Robust (穩健性)**: Handles AI color variations automatically
2. **Accurate (精確性)**: Ensures exact chroma key color for perfect removal
3. **Seamless (無縫整合)**: Transparent to users - happens automatically
4. **Fast (快速)**: Client-side processing, no additional API calls

## Integration (整合)

The normalization is automatically applied in `generateSpriteSheet()`:

```typescript
const generatedImage = `data:image/png;base64,${part.inlineData.data}`;

// Post-process: Normalize background color to exact chroma key color
if (onProgress) onProgress('正在標準化背景顏色...');
const normalizedImage = await normalizeBackgroundColor(
    generatedImage, 
    bgColor,
    chromaKeyColor
);

return normalizedImage;
```

## Testing (測試)

To verify the normalization is working:

1. Generate a sprite sheet with green or magenta background
2. Check the progress indicator shows "正在標準化背景顏色..."
3. Verify background removal works perfectly
4. Inspect the image - background should be exact target color

## Future Improvements (未來改進)

- [ ] Add visual feedback showing before/after normalization
- [ ] Provide statistics on color correction (how many pixels changed)
- [ ] Support custom chroma key colors beyond magenta/green
- [ ] Implement GPU-accelerated normalization for large images

---

**Version**: v1.2.0  
**Date**: 2026-01-30  
**Author**: Sprite Animator Team
