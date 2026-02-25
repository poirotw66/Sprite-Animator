# Magenta Chroma Key — Character Color Being "Eaten" (誤吃人物顏色)

## Problem (問題)

The **magenta (洋紅) background removal** sometimes removes or makes transparent **parts of the character** that are not background — especially **pink/red tones** such as:
- **Cheek blush** (臉頰腮紅)
- **Lips** (嘴唇的紅/粉色)
- Possibly **reddish-brown props** (e.g. mushroom caps) or **light pink** shading on skin

So the algorithm is **too aggressive** in treating "red/pink" as background.

---

## Where the Logic Lives

- **Main removal:** `workers/chromaKeyWorker.ts` — `processChromaKey()`, `isMagentaLikePixel()`, similarity mask, alpha computation, edge erosion.
- **Fuzz constant:** `utils/constants.ts` — `CHROMA_KEY_FUZZ = 35` (35% of 255 ≈ 89 in RGB distance).
- **Call site:** `hooks/useSpriteSheet.ts` uses `CHROMA_KEY_FUZZ` when calling the worker.

---

## Root Causes (問題所在)

### 1. `isMagentaLikePixel` includes red/pink hue (0–35°), not only magenta (~300°)

**Location:** `workers/chromaKeyWorker.ts` (around lines 211–215)

```ts
const isMagentaLikePixel = (r: number, g: number, b: number): boolean => {
  const { h, s } = rgbToHsl(r, g, b);
  const hueOk = (h >= 270 && h <= 360) || (h >= 0 && h <= 35);  // ← problem
  return hueOk && s > 0.25 && r > g * 1.2 && b > g && (r > 100 || b > 80);
};
```

- **Magenta** in HSL has **hue ≈ 300°** (R and B high, G low).
- The condition **`(h >= 0 && h <= 35)`** includes **red and red–pink** (hue 0° = red, 15–35° = orange–pink).
- So **cheek blush** (often hue ~0–20°, pink/red), **lips** (red, ~0–15°), and **light pink skin shading** can satisfy `hueOk` and then the rest of the checks (e.g. `s > 0.25`, `r > g * 1.2`, `b > g`), and be classified as **magenta-like**.
- **Result:** Character red/pink is treated as background.

**Conclusion:** The intent was to catch "magenta and pink background variants", but the **hue range 0–35°** is **red/pink**, not magenta. That range should not be considered "background" for magenta chroma key, or should be much stricter (e.g. only very high R+B and very low G, close to actual magenta).

---

### 2. Unconditional removal of "magenta-like" pixels even when not connected to background

**Location:** `workers/chromaKeyWorker.ts` (around lines 387–389)

```ts
} else if (targetIsMagenta && isMagentaLikePixel(r, g, b)) {
  // Middle cells may be disconnected by white grid lines; remove magenta/pink anyway
  alphaChannel[i] = 0;
}
```

- For **any** pixel that passes `isMagentaLikePixel`, alpha is set to **0** (fully transparent), **even if that pixel is not part of the connected background** (i.e. it is on the character).
- So **isolated** pink blush or red lips in the middle of the face are **always removed** once they are classified as magenta-like.
- The comment says this is to remove "middle cells" background (e.g. when grid lines disconnect the background). But the same branch also removes **character** red/pink because `isMagentaLikePixel` is too wide (see point 1).

**Conclusion:** This is the **main direct cause** of character color being eaten: character blush/lips pass `isMagentaLikePixel` and are then forced to transparent without any check that they are actually background (e.g. connectivity to edges).

---

### 3. Same `isMagentaLikePixel` used in the similarity mask (Pass 1)

**Location:** `workers/chromaKeyWorker.ts` (around line 245)

```ts
if (targetIsMagenta && isMagentaLikePixel(r, g, b)) isMatch = true;
```

- Pixels that pass `isMagentaLikePixel` are marked as **background match** (`similarityMask[i] = 1`) and can be **flood-filled** as background from corners/edges.
- So blush or lips **connected to the edge** (e.g. cheek near the contour) can be included in the background mask and then removed in the alpha pass.
- Even if not connected, they are still removed by the block at 387–389 (point 2).

---

### 4. "Hole" detection can treat strong red/pink as background hole

**Location:** `workers/chromaKeyWorker.ts` (around 391–399)

```ts
} else if (distance < adaptiveFuzz * 0.95) {
  let isCertainHole = false;
  if (targetIsMagenta) {
    isCertainHole = (r > g * 1.4 && b > g * 1.4 && (r + b) > 100) || (r > g * 3 || b > g * 3);
  }
  // ...
  if (isCertainHole) alphaChannel[i] = 15;  // nearly transparent
}
```

- For magenta, **isCertainHole** is true when R and B are much larger than G. **Strong red** (e.g. R=220, G=50, B=80) can satisfy `r > g * 3` and be treated as a "hole" (alpha 15).
- So **red accents** (e.g. red text, red parts of props, or strong red on character) can be made almost transparent.

---

### 5. Edge erosion ("spill") is very permissive for magenta

**Location:** `workers/chromaKeyWorker.ts` (around 426–432)

```ts
if (targetIsMagenta) isSpill = r > g * 1.1 && b > g * 1.1;
// ...
if (isSpill) erodedAlpha[i] = 160;
```

- Any pixel **next to the background** that has `r > g * 1.1 && b > g * 1.1` is treated as "spill" and alpha is reduced to **160**.
- **Light pink** (e.g. R=240, G=200, B=210) satisfies this, so **blush or pink shading near the character edge** can be partially removed (semi-transparent), which looks like the algorithm "eating" into the character.

---

### 6. Fuzz value (35%) is relatively large

**Location:** `utils/constants.ts` — `CHROMA_KEY_FUZZ = 35`

- `fuzz = (35/100) * 255 ≈ 89`. With **adaptiveFuzz** up to **1.5×** (when background is detected), distance threshold can be **~134** from pure magenta (255, 0, 255).
- So pixels that are **moderately pink** (e.g. R=255, G=120, B=255) are within distance ~120 and can be removed by the **distance-based** branch (bgMask or distance < adaptiveFuzz), even without `isMagentaLikePixel`.
- So **fuzz** alone can remove some character pink; combined with **isMagentaLikePixel** and **hue 0–35**, the effect is stronger.

---

## Summary Table

| Cause | Effect | Severity |
|-------|--------|----------|
| **isMagentaLikePixel** uses hue **0–35°** (red/pink) | Blush, lips, light pink classified as "magenta-like" | **High** |
| **Unconditional alpha=0** for all magenta-like pixels (lines 387–389) | Every such pixel on the character becomes transparent | **High** |
| **similarityMask** uses same isMagentaLikePixel | Blush/lips can be flood-filled as background | Medium |
| **isCertainHole** for magenta (r > g*3 etc.) | Strong red on character/props made nearly transparent | Medium |
| **Edge spill** r > g*1.1 && b > g*1.1 | Pink near edges partially removed (alpha 160) | Medium |
| **CHROMA_KEY_FUZZ = 35** + adaptiveFuzz 1.5× | More pink tones within distance threshold | Low–Medium |

---

## Recommended Directions (供決定是否修改時參考)

1. **Narrow magenta-like hue to real magenta (and close pink background only)**  
   - Remove or severely restrict **hue 0–35°** in `isMagentaLikePixel`.  
   - Keep hue around **280–320°** (and maybe a very narrow band near 0/360 if needed for specific pink-background variants), and/or add a **strong constraint** that G must be **very low** (e.g. g < 80 or g < 60) so that skin blush (which usually has significant G) is excluded.

2. **Do not force alpha=0 for magenta-like pixels that are not background**  
   - At the block around 387–389: either **remove** this unconditional removal, or apply it **only** when the pixel is **connected to the background** (e.g. `bgMask[i] === 2` or reachable from background in a connectivity sense). So isolated character blush/lips are never made fully transparent just because they are "magenta-like".

3. **Tighten "hole" and "spill" for magenta**  
   - **isCertainHole:** Require not only R/B dominance but also **low G** (e.g. g < 100) so that skin tones (with notable G) are not treated as holes.  
   - **Spill:** Consider a stricter condition for magenta (e.g. require both `r > g * 1.2` and `b > g * 1.2` and maybe `g < 100`) so that light pink on the character is not eroded.

4. **Optional: reduce default fuzz for magenta**  
   - e.g. Use a lower `CHROMA_KEY_FUZZ` when target is magenta (or a separate constant for magenta) so that only pixels closer to #FF00FF are removed by distance, reducing accidental removal of character pink.

5. **Add an explicit "skin/blush protection" rule (optional)**  
   - For pixels that look like **skin** (e.g. high R, moderate G, moderate B, in a typical skin range), **never** set alpha to 0 based on magenta-like alone, even if they pass a relaxed hue check.

---

---

## Review Summary (審視摘要) — Post-Fix

After the fixes for blush/lips and blue edges, a full pass was done. The following were **addressed**:

| Item | Status | Change |
|------|--------|--------|
| isMagentaLikePixel hue 0–35° (red/pink) | ✅ Fixed | Hue limited to 270–360°; added lowGreen (g < 100). |
| Unconditional alpha=0 for magenta-like | ✅ Fixed | Branch removed; only connected background is removed. |
| Blue edges eaten | ✅ Fixed | notBlueDominant (b ≤ r+30) in isMagentaLikePixel, distance match, spill, and despill skip. |
| isCertainHole removing strong red (text/props) | ✅ Fixed | Added `g < 80` to the (r>g*3 \|\| b>g*3) clause so only very low-G holes are removed. |
| Edge spill eroding light pink blush | ✅ Fixed | Magenta spill now requires `g < 100` so high-G pink (blush) is not eroded. |

**Remaining / acceptable:**

- **Fuzz 35%:** Kept as-is. Reducing it could leave magenta background residue in some images; current protections (lowGreen, notBlueDominant, hole g<80, spill g<100) already avoid most character-color removal.
- **Despill strength:** Applied only when not blue-dominant and with magContrast checks; no further change for now.

**Document purpose:** Identify why magenta chroma key sometimes removes character colors (blush, lips, pink, blue edges). Fixes applied as above.  
**Date:** 2026-02-25
