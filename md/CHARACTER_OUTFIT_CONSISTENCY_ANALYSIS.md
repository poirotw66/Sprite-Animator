# Character / Outfit Consistency — Root Cause Analysis

## Problem (問題)

Generated sprite sheets sometimes show the character with **different clothing or appearance** from the uploaded reference image. The user wants the character's outfit (and overall look) to match or stay very similar to the reference.

**Scope:** Both LINE sticker mode and Animation (sprite sheet) mode.

---

## Current Prompt Instructions (現有指示)

### LINE Sticker (`utils/lineStickerPrompt.ts`)

- **[3. Subject / Character]**  
  - "The **uploaded image is the only reference** for who and what to draw, and for the **visual style** (line weight, shading, proportions, **color palette**, art style)."  
  - "**Consistency**: Invariants = number of subjects, face proportions, skin tones, hair silhouettes, **outfits**, color scheme. Variants = expressions, eye shapes, mouth shapes, gestures, postures, **small props**."

- **DEFAULT_CHARACTER_SLOT.originalImageRules**  
  - "Draw exactly the subject(s) and **visual style** from the reference image. … Do not reduce to one character. Layout follows the sticker grid."

### Animation (`services/gemini/spriteSheetPrompts.ts`)

- **[3. Subject / Character]**  
  - "The **uploaded image is the main source**. Draw **this exact character**: same face, hair, **outfit**, color palette, proportions, and recognisable features. Do not replace them with a generic character."  
  - "**Consistency**: Invariants = face proportions, skin tone, hair silhouette, **main outfit**, color scheme. Variants = pose, expression, limb positions only."

So both modes **do** list outfit as an invariant, but the following factors can still lead to outfit/appearance drift.

---

## Root Causes (可能原因)

### 1. Style presets override “color palette from reference” (LINE 貼圖)

**Location:** `utils/lineStickerPrompt.ts` → **STYLE_PRESETS**, injected in **[2. Style / Art Medium]** (before [3. Subject / Character]).

Several presets describe **specific colors or palettes** that conflict with “use the reference’s color palette”:

| Preset   | Style / drawingMethod wording that can change clothes/colors      |
|----------|--------------------------------------------------------------------|
| lineChibi| "**Soft warm color palette (cream and muted orange)**", "Round, squishy body, tiny paws" |
| pastel   | "**light pink and mint tones**", "rounded shapes"                  |
| yurukawa | "**earthy tones, beige and brown dominant colors**", "low saturation" |
| gouache  | "**warm and cozy palette**"                                        |
| minimalist| "**dot eyes and soft blush**", "rounded simplified shapes"         |
| pixel    | "**limited color palette**"                                       |

- **[2]** says e.g. “use cream and muted orange” or “light pink and mint”.
- **[3]** says “uploaded image is the only reference … **color palette**”.
- The model may **follow the style palette** and recolor or simplify the character’s clothes, so the outfit no longer matches the reference.

**Conclusion:** Style section can effectively **override** “same outfit / same color palette” when it specifies a fixed palette or look.

---

### 2. Section order: Style before Character (LINE 貼圖)

**Order:** [1] Global Layout → [2] **Style / Art Medium** → [3] **Subject / Character** → [4] Lighting → [5] Grid Content → …

- The most concrete, “directive” text (e.g. “cream and muted orange”, “light pink and mint”) is in **[2]**.
- “Reference is the only source for color palette / outfit” is in **[3]**.
- Models often give strong weight to early, specific instructions; “from reference” can be treated as secondary and result in **style-driven outfit/color changes**.

---

### 3. “Visual style” and “outfits” not explicit enough

- **originalImageRules:** “Draw exactly the subject(s) and **visual style** from the reference image.”  
  - “Visual style” is ambiguous: it can be read as **only** line weight / shading / art style, not necessarily “the same clothes and accessories”.
- **Consistency** says “Invariants = … outfits” but there is **no explicit negative rule**, e.g.:  
  - “Do NOT change or redesign the character’s clothing, costume, or accessories.”  
  - “The outfit must be **identical** to the reference in every cell.”

So the model is not clearly told that **changing clothes is forbidden**.

---

### 4. “Small props” as variant (LINE 貼圖)

- Line: “Variants = expressions, eye shapes, mouth shapes, gestures, postures, **small props**.”
- “Small props” can be interpreted as **accessories** (hat, glasses, scarf, bag). If the model treats them as variable, it may add/remove/change accessories that the user considers part of the **outfit**, leading to perceived outfit inconsistency.

---

### 5. Per-cell actions (LINE 貼圖)

- **[5. Grid Content]** gives each cell a different **Action** (e.g. “waving hand”, “thumbs up with smile”, “tilting head confused”), from `actionDescriptions.ts` or theme.
- The action descriptions are **pose/expression only** and do not mention clothing.
- However, the model might still infer “different action → different situation” and unconsciously **vary outfit** (e.g. “celebrating” → more festive clothes) unless we explicitly forbid changing clothes regardless of action.

---

### 6. Single image + long text: reference may be underweighted

- **API call:** One reference image + one long text (layout, style, character, lighting, grid content, etc.).
- The long prompt contains many strong, concrete instructions (grid, style, colors, text, actions). The short “draw from this image, same outfit/palette” can be **diluted**.
- If the model leans on text more than the image, it may “follow style + action” and **drift from the reference outfit**.

---

### 7. Animation mode (weaker than LINE but same idea)

- Animation prompt does **not** use STYLE_PRESETS with fixed palettes; it only says “Flat shading only” and “same face, hair, **outfit**, color palette”.
- So **animation mode has less conflict** than LINE. However:
  - There is still **no** explicit “Do NOT change clothing” or “Outfit must be identical to reference.”
  - Long prompt + single reference image can still lead to slight outfit drift.

---

## Summary Table

| Factor | LINE Sticker | Animation | Effect |
|--------|--------------|-----------|--------|
| Style preset with fixed palette (e.g. cream/orange, pink/mint) | ✅ Yes | ❌ No | Strong: can recolor or simplify outfit |
| Style section before Character section | ✅ Yes | N/A | Medium: style may override “from reference” |
| Only “outfits” as invariant, no “do not change” rule | ✅ Yes | ✅ Yes | Medium: model may still vary clothes |
| “Small props” as variant | ✅ Yes | No | Low–medium: accessories may change |
| Per-cell actions (might imply outfit change) | ✅ Yes | N/A | Low: possible implicit outfit change |
| Single image + long text | ✅ Yes | ✅ Yes | Medium: reference can be underweighted |

---

## Recommended Directions (後續可採取的改進，僅供參考)

1. **Clarify priority:** In [3] or in a single “CRITICAL” line, state that **character design (including outfit, costume, colors) must come from the reference image only** and must not be overridden by [2] Style. Style applies to **rendering** (line weight, shading, texture), not to **character design/clothing**.
2. **Add an explicit negative rule:** e.g. “Do NOT change, simplify, or redesign the character’s clothing, costume, or accessories. The outfit must be the same as in the reference in every cell.”
3. **Tone down style presets:** Remove or soften **fixed color palettes** (e.g. “cream and muted orange”) from STYLE_PRESETS; describe only technique (e.g. “flat colors”, “soft shading”) and add “Keep the character’s colors and outfit from the reference.”
4. **Tighten “Variants”:** Consider removing “small props” from Variants or rephrasing to “small props **that are clearly not part of the reference outfit**” so accessories that are part of the look are not changed.
5. **Optional:** Repeat one short “Same outfit as reference in every cell” in [5. Grid Content] or [7. Final Goal] so it appears near the per-cell instructions.

---

**Document purpose:** Identify why generated character outfit sometimes differs from the uploaded reference. No code changes in this step.  
**Date:** 2026-02-25
