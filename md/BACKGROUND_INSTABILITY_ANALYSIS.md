# Background Instability — Root Cause Analysis

**Status:** The green contradiction in the LINE sticker prompt and the constant/docs mismatch have been fixed (unified to #00FF00). See changelog and current code.

## Summary

Image generation background is sometimes unstable because of **contradictory green specifications** in the prompt, **mismatch between constants and documentation**, and **model / normalization limits**. Below are the exact locations and causes.

---

## 1. Green Color Contradiction in LINE Sticker Prompt (Primary Cause)

**File:** `services/gemini/spriteSheetPrompts.ts`  
**Function:** `buildLineStickerPromptSuffix()`

The suffix is built from two sources:

- **Variables** (from `CHROMA_KEY_COLORS` in `utils/constants.ts`):  
  For green: `bgColorHex = '#00FF00'`, `bgColorRGB = 'RGB(0, 255, 0)'`.

- **Hardcoded green block** in the same function (lines 57–60):  
  "R = 0, G = 177, B = 64", "Must be standard green screen **#00B140**".

So the same prompt contains:

- "The background MUST be a solid color **#00FF00** (RGB(0, 255, 0))"
- "Every background pixel MUST be EXACTLY **#00FF00**"
- And also: "R = 0, G = 177, B = 64", "standard green screen **#00B140**"

So the model is told **two different greens** in one request. That can lead to:

- Sometimes following #00FF00 → consistent background.
- Sometimes following #00B140 → different shade, or mixed/gradient backgrounds.
- Unpredictable behaviour across runs → **background instability**.

**Conclusion:** The hardcoded green block in `spriteSheetPrompts.ts` (G=177, #00B140) conflicts with the variable-driven requirement (#00FF00) and with the actual chroma key used in the app.

---

## 2. Constants vs Documentation vs Prompt

| Source | Green definition | Location |
|--------|-------------------|----------|
| **App constant** | `#00FF00` (0, 255, 0) | `utils/constants.ts` → `CHROMA_KEY_COLORS.green` |
| **LINE prompt body** | "Neon Green #00FF00" | `utils/lineStickerPrompt.ts` (e.g. `bgColorText`, `bgHex`) |
| **LINE suffix (variable part)** | #00FF00, RGB(0,255,0) | `spriteSheetPrompts.ts` via `bgColorHex` / `bgColorRGB` |
| **LINE suffix (hardcoded block)** | #00B140, (0, 177, 64) | `services/gemini/spriteSheetPrompts.ts` green branch |
| **Docs** | #00B140 "industry standard" | `BACKGROUND_COLOR_NORMALIZATION.md`, `CHANGELOG_COLOR_NORMALIZATION.md` |

Normalization and chroma key removal use `CHROMA_KEY_COLORS` (#00FF00). So:

- Any prompt text that says "#00B140" or (0, 177, 64) is **inconsistent** with the rest of the app and can encourage the model to produce a different green, contributing to instability.
- Documentation that describes #00B140 as the target is also out of sync with the code.

---

## 3. Normalization Cannot Fix All Variants

**File:** `services/gemini/imageUtils.ts`  
**Function:** `normalizeBackgroundColor()`

- Normalization replaces pixels that are **detected as background** with the exact chroma key from `CHROMA_KEY_COLORS`.
- Detection uses several conditions (e.g. isPureGreen, isStandardGreenScreen, isNeonGreen, isGreenVariant) and a Euclidean distance tolerance (100).

If the model outputs:

- **Gradients** (e.g. light green to dark green): only some pixels may match the conditions; others are left as-is → uneven background.
- **Wrong hue** (e.g. cyan/teal): may fall outside the green detection → not normalized → visible patches.
- **Mixed instructions**: sometimes #00FF00-like, sometimes #00B140-like → inconsistent look.

So even with normalization, **prompt inconsistency** can still produce backgrounds that are only partially corrected → perceived instability.

---

## 4. Style / Lighting Wording (Secondary)

**File:** `utils/lineStickerPrompt.ts`  
**Section:** [2. Style / Art Medium], [4. Lighting & Background]

For styles with `lightingPreference: 'soft'` (e.g. watercolor, gouache):

- The prompt allows "Soft, subtle shading", "Minimal shadows", "gentle wash or soft gradients".
- That can be interpreted as applying subtle shading or gradients **on the background** as well, which conflicts with "one single RGB value for all background pixels" and "no gradients" in [4. Lighting & Background].

So for soft-lighting styles, the model may occasionally add slight background variation, contributing to instability.

---

## 5. Where Things Are Consistent

- **Magenta:** All references use #FF00FF (255, 0, 255); no contradiction in the prompt.
- **Animation mode** (non-LINE): Uses `bgColorHex` / `bgColorRGB` from the same constants and does not append the LINE suffix; no #00B140 in that path.
- **Chroma key worker** (`workers/chromaKeyWorker.ts`): Expects #00FF00 for green (comment line 77); no #00B140 there.

So the main source of **green** instability is the LINE sticker suffix’s hardcoded #00B140 block and the documentation/comment references to #00B140, not the worker or the animation prompt.

---

## 6. Recommended Fixes (for future implementation)

1. **Remove the green contradiction in `spriteSheetPrompts.ts`**  
   In the green branch of `buildLineStickerPromptSuffix()`, do not hardcode G=177 or #00B140. Use the same `bgColorHex` and `bgColorRGB` as for the rest of the suffix (i.e. #00FF00 and RGB(0, 255, 0) when green is selected), and optionally add a short "wrong greens to avoid" list (e.g. cyan, grass green) without specifying another target hex.

2. **Unify green definition everywhere**  
   Decide a single target: either the app stays with #00FF00 (current constant) and all prompts/docs say only #00FF00, or the app and prompts/docs all switch to #00B140 and constants/worker are updated. Do not mix both in prompts.

3. **Clarify background vs lighting**  
   In [4. Lighting & Background] or [2. Style], add one explicit line: "Background must be a single flat color (no gradients or shading on the background)." so that soft-lighting styles do not add variation to the background.

4. **Optional: tighten normalization**  
   If needed, slightly widen the green detection (e.g. hue range or distance tolerance) so that #00B140-like pixels are always normalized when the chosen target is #00FF00, reducing residual variation when the model occasionally follows old docs or copy-paste.

---

**Document purpose:** Identify root causes of background instability without changing code.  
**Date:** 2026-02-25
