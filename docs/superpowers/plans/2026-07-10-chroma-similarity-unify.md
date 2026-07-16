# Chroma Similarity Unify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify normalize + chroma-key background detection on one YCbCr chroma-distance API, retune thresholds for quality, and add a guided-sheet simplified path.

**Architecture:** New pure module `utils/chromaSimilarity.ts` owns distance + `isChromaLike(mode)`. `normalizeChromaBackground` and `processChromaKey` both call it. Optional `guided` (flag or auto-detect) skips aggressive hole/clothing specials. Outer Worker / `processSheetChromaKey` APIs stay compatible; `fuzzPercent` maps onto key chroma max via a thin adapter.

**Tech Stack:** TypeScript, Vitest, existing `@napi-rs/canvas` only where tests already use it (not required for similarity unit tests), shared `utils/chromaKeyCore.ts` + Web Worker.

**Spec:** `docs/superpowers/specs/2026-07-10-chroma-similarity-unify-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `utils/chromaSimilarity.ts` | **Create** — YCbCr, chroma distance, `isChromaLike`, thresholds, soft-edge helper, `fuzzPercentToKeyMax` adapter |
| `utils/chromaSimilarity.test.ts` | **Create** — similarity unit tests |
| `utils/chromaGuidedDetect.ts` | **Create** — light auto-detect for regular gutters (optional guided) |
| `utils/chromaGuidedDetect.test.ts` | **Create** — auto-detect tests |
| `utils/normalizeChromaBackground.ts` | **Modify** — call `isChromaLike(..., 'normalize')` |
| `utils/normalizeChromaBackground.test.ts` | **Modify** — keep / adjust expectations |
| `utils/chromaKeyCore.ts` | **Modify** — shared similarity; soft edge; `guided` option; skip hole/clothing when guided |
| `utils/chromaKeyCore.test.ts` | **Modify** — hard cases + guided |
| `utils/constants.ts` | **Modify** — comment / deprecate note for `CHROMA_KEY_FUZZ` (keep export) |
| `utils/chromaKeyProcessor.ts` | **Modify** — pass optional `guided` through to core |
| `workers/chromaKeyWorker.ts` | **Modify** — optional `guided` on message |
| `scripts/line-sticker/nodeImage.mts` | **Modify** — `processSheetChromaKey(..., { guided? })` |
| `scripts/line-sticker/sheetGeneration.mts` | **Modify** — pass `guided` when template is guided |
| `scripts/line-sticker/reslice-sheet.mts` | **Modify** — pass guided when template present |

---

### Task 1: `chromaSimilarity` module (TDD)

**Files:**
- Create: `utils/chromaSimilarity.ts`
- Create: `utils/chromaSimilarity.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import {
  rgbToYCbCr,
  chromaDistanceToKey,
  isChromaLike,
  CHROMA_LIKE_NORMALIZE_MAX,
  CHROMA_LIKE_KEY_MAX,
  CHROMA_LIKE_SOFT_EXTRA,
  fuzzPercentToKeyMax,
} from './chromaSimilarity';

const green = { r: 0, g: 255, b: 0 };
const magenta = { r: 255, g: 0, b: 255 };

describe('rgbToYCbCr', () => {
  it('maps pure green to high Y and green-ish chroma', () => {
    const { y, cb, cr } = rgbToYCbCr(0, 255, 0);
    expect(y).toBeGreaterThan(100);
    expect(cb).toBeLessThan(0);
    expect(cr).toBeLessThan(0);
  });
});

describe('chromaDistanceToKey', () => {
  it('is ~0 for the exact key color', () => {
    expect(chromaDistanceToKey(0, 255, 0, green)).toBeLessThan(1);
  });

  it('ignores brightness: dark green stays close to neon green key', () => {
    const d = chromaDistanceToKey(0, 120, 0, green);
    expect(d).toBeLessThan(CHROMA_LIKE_NORMALIZE_MAX);
  });
});

describe('isChromaLike', () => {
  it('accepts pure and AI-variant greens for normalize', () => {
    expect(isChromaLike(0, 255, 0, green, 'normalize')).toBe(true);
    expect(isChromaLike(0, 193, 64, green, 'normalize')).toBe(true);
    expect(isChromaLike(10, 180, 20, green, 'normalize')).toBe(true);
  });

  it('rejects skin, gray, and blue cloth', () => {
    expect(isChromaLike(255, 200, 180, green, 'normalize')).toBe(false);
    expect(isChromaLike(80, 60, 40, green, 'key')).toBe(false);
    expect(isChromaLike(40, 80, 200, green, 'key')).toBe(false);
  });

  it('accepts pure magenta and rejects blush-like red', () => {
    expect(isChromaLike(255, 0, 255, magenta, 'key')).toBe(true);
    expect(isChromaLike(220, 120, 130, magenta, 'key')).toBe(false);
  });

  it('uses a stricter key threshold than normalize for borderline greens', () => {
    // Pick a pixel that is near the normalize boundary; if none exists in fixtures,
    // assert CHROMA_LIKE_KEY_MAX < CHROMA_LIKE_NORMALIZE_MAX and soft extra is positive.
    expect(CHROMA_LIKE_KEY_MAX).toBeLessThan(CHROMA_LIKE_NORMALIZE_MAX);
    expect(CHROMA_LIKE_SOFT_EXTRA).toBe(12);
  });
});

describe('fuzzPercentToKeyMax', () => {
  it('maps 35% near the default key max band', () => {
    const mapped = fuzzPercentToKeyMax(35);
    expect(mapped).toBeGreaterThan(20);
    expect(mapped).toBeLessThan(80);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run utils/chromaSimilarity.test.ts`

Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement `utils/chromaSimilarity.ts`**

```typescript
export type ChromaLikeMode = 'normalize' | 'key';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface YCbCr {
  y: number;
  cb: number;
  cr: number;
}

/** Spec defaults; retune only with hard-case tests. */
export const CHROMA_LIKE_NORMALIZE_MAX = 55;
export const CHROMA_LIKE_KEY_MAX = 38;
export const CHROMA_LIKE_SOFT_EXTRA = 12;

export function rgbToYCbCr(r: number, g: number, b: number): YCbCr {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 0.564 * (b - y);
  const cr = 0.713 * (r - y);
  return { y, cb, cr };
}

export function chromaDistanceToKey(
  r: number,
  g: number,
  b: number,
  key: RgbColor
): number {
  const p = rgbToYCbCr(r, g, b);
  const k = rgbToYCbCr(key.r, key.g, key.b);
  const dCb = p.cb - k.cb;
  const dCr = p.cr - k.cr;
  return Math.hypot(dCb, dCr);
}

function keyLooksGreen(key: RgbColor): boolean {
  return key.g >= key.r && key.g >= key.b;
}

function keyLooksMagenta(key: RgbColor): boolean {
  return key.r > 200 && key.b > 200 && key.g < 80;
}

/** Direction gate after distance — blocks skin/gray false positives. */
function passesDirectionGate(r: number, g: number, b: number, key: RgbColor): boolean {
  if (keyLooksGreen(key)) {
    return g > r * 1.05 && g > b * 1.05;
  }
  if (keyLooksMagenta(key)) {
    return r > g * 1.2 && b > g * 1.2 && g < 80 && b <= r + 40;
  }
  // Unknown key: distance-only
  return true;
}

export function isChromaLike(
  r: number,
  g: number,
  b: number,
  key: RgbColor,
  mode: ChromaLikeMode,
  maxDistance?: number
): boolean {
  const limit =
    maxDistance ??
    (mode === 'normalize' ? CHROMA_LIKE_NORMALIZE_MAX : CHROMA_LIKE_KEY_MAX);
  if (chromaDistanceToKey(r, g, b, key) > limit) return false;
  return passesDirectionGate(r, g, b, key);
}

/** Soft-edge band: within key max + soft extra, still chroma-directed. */
export function isChromaSoftEdge(
  r: number,
  g: number,
  b: number,
  key: RgbColor,
  keyMax: number = CHROMA_LIKE_KEY_MAX
): boolean {
  const d = chromaDistanceToKey(r, g, b, key);
  if (d > keyMax + CHROMA_LIKE_SOFT_EXTRA) return false;
  return passesDirectionGate(r, g, b, key);
}

/**
 * Map legacy UI fuzzPercent (0–100) onto a key chroma-distance max.
 * 35% → ~CHROMA_LIKE_KEY_MAX; clamp to a sane band.
 */
export function fuzzPercentToKeyMax(fuzzPercent: number): number {
  const t = Math.max(0, Math.min(100, fuzzPercent)) / 35;
  return Math.max(18, Math.min(70, CHROMA_LIKE_KEY_MAX * t));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run utils/chromaSimilarity.test.ts`

Expected: PASS

If AI-variant greens fail the direction gate, loosen `g > r * 1.05` slightly (e.g. `1.02`) and re-run — document the final constants in the commit message.

- [ ] **Step 5: Commit**

```bash
git add utils/chromaSimilarity.ts utils/chromaSimilarity.test.ts
git commit -m "feat(chroma): add shared YCbCr chroma-likeness module"
```

---

### Task 2: Point normalize at shared API

**Files:**
- Modify: `utils/normalizeChromaBackground.ts`
- Modify: `utils/normalizeChromaBackground.test.ts`

- [ ] **Step 1: Update normalize tests if needed**

Keep existing cases. Add one that a dark green variant still snaps:

```typescript
it('snaps dark green AI variant to exact target', () => {
  const data = new Uint8ClampedArray([0, 120, 0, 255, 255, 200, 180, 255]);
  const count = normalizeChromaBackgroundInPlace(
    data,
    'green',
    { r: 0, g: 255, b: 0 }
  );
  expect(count).toBe(1);
  expect(Array.from(data.slice(0, 4))).toEqual([0, 255, 0, 255]);
});
```

- [ ] **Step 2: Run normalize tests (expect possible fail on dark green until impl)**

Run: `npx vitest run utils/normalizeChromaBackground.test.ts`

- [ ] **Step 3: Rewrite `isChromaBackgroundPixel` to delegate**

Replace the heuristic body in `utils/normalizeChromaBackground.ts` with:

```typescript
import {
  isChromaLike,
  CHROMA_LIKE_NORMALIZE_MAX,
  type RgbColor as SimRgb,
} from './chromaSimilarity';

// Keep exported RgbColor / CHROMA_BACKGROUND_NORMALIZE_TOLERANCE for callers.
// Map legacy tolerance onto normalize max when provided; default uses module constant.

export function isChromaBackgroundPixel(
  r: number,
  g: number,
  b: number,
  colorType: ChromaKeyColorType,
  targetColor: RgbColor,
  tolerance: number = CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
): boolean {
  // Legacy tolerance was RGB Euclidean (~100). Map roughly onto chroma max:
  // when caller passes default 100, use CHROMA_LIKE_NORMALIZE_MAX; otherwise scale.
  const maxDistance =
    tolerance === CHROMA_BACKGROUND_NORMALIZE_TOLERANCE
      ? CHROMA_LIKE_NORMALIZE_MAX
      : Math.max(20, Math.min(80, (tolerance / 100) * CHROMA_LIKE_NORMALIZE_MAX));
  void colorType; // key RGB already encodes green vs magenta
  return isChromaLike(r, g, b, targetColor as SimRgb, 'normalize', maxDistance);
}
```

Leave `normalizeChromaBackgroundInPlace` loop unchanged (still calls `isChromaBackgroundPixel`).

- [ ] **Step 4: Run normalize + similarity tests**

Run: `npx vitest run utils/normalizeChromaBackground.test.ts utils/chromaSimilarity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add utils/normalizeChromaBackground.ts utils/normalizeChromaBackground.test.ts
git commit -m "refactor(chroma): normalize uses shared isChromaLike"
```

---

### Task 3: Wire `processChromaKey` similarity + soft edge to shared API

**Files:**
- Modify: `utils/chromaKeyCore.ts`
- Modify: `utils/chromaKeyCore.test.ts`
- Modify: `utils/constants.ts` (comment only in this task)

- [ ] **Step 1: Extend core tests with hard cases**

Append to `utils/chromaKeyCore.test.ts`:

```typescript
function makeGreenWithRedCenterAndGreenProp(w: number, h: number, inset: number) {
  const data = makeGreenWithRedCenter(w, h, inset);
  // Small green square inside the red subject (not connected to sheet edge)
  for (let y = h / 2 - 2; y < h / 2 + 2; y++) {
    for (let x = w / 2 - 2; x < w / 2 + 2; x++) {
      const i = (y * w + x) * 4;
      data[i] = 0;
      data[i + 1] = 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('processChromaKey hard cases', () => {
  it('keeps an interior green prop that is not edge-connected', () => {
    const w = 40, h = 40, inset = 8;
    const data = makeGreenWithRedCenterAndGreenProp(w, h, inset);
    processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {});
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, w / 2, h / 2)).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2: Run to see current / new behavior**

Run: `npx vitest run utils/chromaKeyCore.test.ts`

Note whether the interior green prop is already kept (connectivity) or wiped. Implementation must keep it.

- [ ] **Step 3: Change `processChromaKey` signature to accept options object (backward compatible)**

Keep positional args working. Add an optional trailing options bag **or** overload via last parameter object. Prefer extending the existing trailing params:

Current:

```typescript
processChromaKey(data, width, height, chromaKey, fuzzPercent, onProgress, edgeBandRadius?, edgeBlend?)
```

Change to also accept optional 9th arg:

```typescript
export interface ProcessChromaKeyOptions {
  guided?: boolean; // undefined = auto later; true/false explicit
  keyMaxOverride?: number;
}

export function processChromaKey(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress: (progress: number) => void,
  edgeBandRadius: number = DEFAULT_EDGE_BAND_RADIUS,
  edgeBlend: number = DEFAULT_EDGE_BLEND,
  options: ProcessChromaKeyOptions = {}
): Uint8ClampedArray
```

Inside Pass 1 similarity loop, replace RGB Euclidean + magenta/green HSL gates with:

```typescript
import {
  isChromaLike,
  isChromaSoftEdge,
  fuzzPercentToKeyMax,
  CHROMA_LIKE_KEY_MAX,
} from './chromaSimilarity';

const keyMax = options.keyMaxOverride ?? fuzzPercentToKeyMax(fuzzPercent);
// similarityMask[i] = 1 when isChromaLike(r,g,b, targetColor, 'key', keyMax)
```

For soft alpha near confirmed background, use `isChromaSoftEdge` / distance vs `keyMax + CHROMA_LIKE_SOFT_EXTRA` instead of `adaptiveFuzz + softness` RGB.

Keep connectivity flood-fill, island pass, despill, edge blend structure.

Remove or bypass obsolete `isMagentaLikePixel` / RGB distance blocks that duplicate the shared detector (do not leave two competing gates).

- [ ] **Step 4: Run core tests**

Run: `npx vitest run utils/chromaKeyCore.test.ts`

Expected: PASS (including interior green prop). If fringes fail later tasks, retune `CHROMA_LIKE_KEY_MAX` only with tests.

- [ ] **Step 5: Comment `CHROMA_KEY_FUZZ` in constants**

```typescript
/** @deprecated Prefer chromaSimilarity CHROMA_LIKE_*; still mapped via fuzzPercentToKeyMax. */
export const CHROMA_KEY_FUZZ = 35;
```

- [ ] **Step 6: Commit**

```bash
git add utils/chromaKeyCore.ts utils/chromaKeyCore.test.ts utils/constants.ts
git commit -m "feat(chroma): key similarity uses shared chroma distance"
```

---

### Task 4: Guided simplify path + auto-detect

**Files:**
- Create: `utils/chromaGuidedDetect.ts`
- Create: `utils/chromaGuidedDetect.test.ts`
- Modify: `utils/chromaKeyCore.ts`
- Modify: `utils/chromaKeyCore.test.ts`

- [ ] **Step 1: Write auto-detect tests**

```typescript
import { describe, expect, it } from 'vitest';
import { shouldUseGuidedChromaPath } from './chromaGuidedDetect';

function fillGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255;
  }
}

describe('shouldUseGuidedChromaPath', () => {
  it('returns false when guided is explicitly false', () => {
    const data = new Uint8ClampedArray(20 * 20 * 4);
    fillGreen(data);
    expect(
      shouldUseGuidedChromaPath(data, 20, 20, { r: 0, g: 255, b: 0 }, false)
    ).toBe(false);
  });

  it('returns true when guided is explicitly true', () => {
    const data = new Uint8ClampedArray(4);
    expect(
      shouldUseGuidedChromaPath(data, 1, 1, { r: 0, g: 255, b: 0 }, true)
    ).toBe(true);
  });

  it('auto-detects a solid chroma field with seam samples as guided-like', () => {
    const w = 40, h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreen(data);
    // red blocks in a 2x2 cell pattern leaving green gutters
    const paint = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          data[i] = 220; data[i + 1] = 30; data[i + 2] = 40;
        }
    };
    paint(2, 2, 18, 18);
    paint(22, 2, 38, 18);
    paint(2, 22, 18, 38);
    paint(22, 22, 38, 38);
    expect(
      shouldUseGuidedChromaPath(data, w, h, { r: 0, g: 255, b: 0 }, undefined)
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Implement `chromaGuidedDetect.ts`**

```typescript
import { isChromaLike, type RgbColor } from './chromaSimilarity';

/**
 * Resolve whether to use the guided (simplified) chroma path.
 * guided === true/false wins; undefined → light auto-detect.
 */
export function shouldUseGuidedChromaPath(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  key: RgbColor,
  guided: boolean | undefined
): boolean {
  if (guided === true) return true;
  if (guided === false) return false;

  // Auto: corners + mid-edge samples mostly chroma-like
  const samples: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];
  let like = 0;
  for (const [x, y] of samples) {
    const i = (y * width + x) * 4;
    if (isChromaLike(data[i]!, data[i + 1]!, data[i + 2]!, key, 'key')) like++;
  }
  if (like < 6) return false;

  // Continuous vertical mid-seam band (gutter heuristic)
  const mx = Math.floor(width / 2);
  let seam = 0;
  const step = Math.max(1, Math.floor(height / 16));
  for (let y = 0; y < height; y += step) {
    const i = (y * width + mx) * 4;
    if (isChromaLike(data[i]!, data[i + 1]!, data[i + 2]!, key, 'normalize')) seam++;
  }
  return seam >= 10;
}
```

- [ ] **Step 3: In `processChromaKey`, resolve guided and branch**

At start of processing:

```typescript
import { shouldUseGuidedChromaPath } from './chromaGuidedDetect';

const useGuided = shouldUseGuidedChromaPath(
  data,
  width,
  height,
  chromaKey,
  options.guided
);
```

When `useGuided`:

1. Skip the “certain hole” branch that forces `alphaChannel[i] = 15` for non-connected chroma-like pixels.
2. Skip clothing-direction spill gates that are separate from shared `isChromaLike` (keep generic despill on edge band only).
3. Use stricter island cap, e.g. `MAX_ISLAND_SIZE = 80` instead of `400`.

When not guided: keep current hole/island behavior (but still using shared similarity from Task 3).

- [ ] **Step 4: Add guided core test**

```typescript
it('guided path does not hole-punch interior chroma-like pixels', () => {
  const w = 40, h = 40, inset = 8;
  const data = makeGreenWithRedCenterAndGreenProp(w, h, inset);
  processChromaKey(data, w, h, { r: 0, g: 255, b: 0 }, 35, () => {}, 2, 0.22, {
    guided: true,
  });
  expect(alphaAt(data, w, w / 2, h / 2)).toBeGreaterThan(200);
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run utils/chromaGuidedDetect.test.ts utils/chromaKeyCore.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add utils/chromaGuidedDetect.ts utils/chromaGuidedDetect.test.ts utils/chromaKeyCore.ts utils/chromaKeyCore.test.ts
git commit -m "feat(chroma): guided simplify path with auto-detect"
```

---

### Task 5: Wire callers (Worker, processor, nodeImage, sheet scripts)

**Files:**
- Modify: `utils/chromaKeyProcessor.ts`
- Modify: `workers/chromaKeyWorker.ts`
- Modify: `scripts/line-sticker/nodeImage.mts`
- Modify: `scripts/line-sticker/sheetGeneration.mts`
- Modify: `scripts/line-sticker/reslice-sheet.mts`

- [ ] **Step 1: Extend Worker message + processor**

In `workers/chromaKeyWorker.ts`, add optional `guided?: boolean` to `ChromaKeyWorkerProcessMessage` and pass as last arg to `processChromaKey`.

In `utils/chromaKeyProcessor.ts`, extend `ChromaKeyOptions`:

```typescript
export interface ChromaKeyOptions {
  edgeBandRadius?: number;
  edgeBlend?: number;
  guided?: boolean;
}
```

Thread `options.guided` into Worker postMessage and main-thread `processChromaKey(..., options)`.

- [ ] **Step 2: Extend `processSheetChromaKey` / `removeChromaKey` in nodeImage**

```typescript
export interface SheetChromaKeyOptions {
  guided?: boolean;
}

export function processSheetChromaKey(
  image: RgbaImage,
  chromaKeyColor: ChromaKeyColorType,
  options: SheetChromaKeyOptions = {}
): RgbaImage {
  normalizeChromaBackground(image, chromaKeyColor);
  return removeChromaKey(image, chromaKeyColor, options);
}

export function removeChromaKey(
  image: RgbaImage,
  chromaKeyColor: ChromaKeyColorType,
  options: SheetChromaKeyOptions = {}
): RgbaImage {
  const c = CHROMA_KEY_COLORS[chromaKeyColor];
  processChromaKey(
    image.data,
    image.width,
    image.height,
    { r: c.r, g: c.g, b: c.b },
    CHROMA_KEY_FUZZ,
    () => {},
    CHROMA_KEY_EDGE_BAND_RADIUS,
    CHROMA_KEY_EDGE_BLEND,
    { guided: options.guided }
  );
  return image;
}
```

- [ ] **Step 3: Pass guided from sheet generation**

In `sheetGeneration.mts`, where `processSheetChromaKey(image, chromaKeyColor)` is called:

```typescript
processSheetChromaKey(image, chromaKeyColor, {
  guided: sheetTemplate?.mode === 'guided',
});
```

In `reslice-sheet.mts`, if guided template file exists, pass `{ guided: true }`.

- [ ] **Step 4: Run full unit suite**

Run: `npx vitest run`

Expected: all previously passing tests still pass; new chroma tests pass.

- [ ] **Step 5: Commit**

```bash
git add utils/chromaKeyProcessor.ts workers/chromaKeyWorker.ts \
  scripts/line-sticker/nodeImage.mts \
  scripts/line-sticker/sheetGeneration.mts \
  scripts/line-sticker/reslice-sheet.mts
git commit -m "feat(chroma): wire guided flag through worker and sheet pipeline"
```

---

### Task 6: Smoke on guided sheet + acceptance

**Files:** none required (commands + optional note in PR)

- [ ] **Step 1: Re-process an existing guided sheet (no Gemini)**

If `output/twice-7-school-daily/sheet-1/_raw-sheet.*` or `_processed-sheet.png` exists, write a tiny one-off or reuse reslice:

```bash
npx tsx scripts/line-sticker/reslice-sheet.mts ^
  "c:\Users\sora0\Desktop\Sprite-Animator\output\twice-7-school-daily\sheet-1" 4 5
```

(Adjust if script expects raw vs processed — follow script usage; ensure guided template file is present so `guided: true` is passed.)

- [ ] **Step 2: Visual spot-check**

Open `_processed-sheet.png` and a few stickers: gutters clean, no heavy green/magenta fringe, green/magenta character accents not wiped.

- [ ] **Step 3: Full vitest once more**

Run: `npx vitest run`

Expected: PASS

- [ ] **Step 4: Final commit if smoke required code tweaks**

Only if constants were retuned:

```bash
git add utils/chromaSimilarity.ts
git commit -m "tune(chroma): adjust CHROMA_LIKE_* after guided sheet smoke"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Shared `chromaSimilarity` API | Task 1 |
| Normalize uses shared like | Task 2 |
| Key uses chroma distance + soft edge | Task 3 |
| Guided flag + auto-detect + simplify rules | Task 4 |
| Wire LINE/sheet + Worker optional guided | Task 5 |
| Vitest + guided sheet smoke | Tasks 1–6 |
| Keep outer APIs / fuzz adapter | Tasks 3, 5 (`fuzzPercentToKeyMax`) |
| No AI matting / no full despill rewrite | Out of scope (not tasked) |

## Self-review notes

- No TBD placeholders in steps.
- `ProcessChromaKeyOptions.guided` and `SheetChromaKeyOptions.guided` naming is consistent.
- Soft-edge constant `CHROMA_LIKE_SOFT_EXTRA = 12` matches spec.
- Auto-detect lives in `chromaGuidedDetect.ts` so `chromaKeyCore` stays focused on pixel passes.
