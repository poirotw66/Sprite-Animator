# Chroma Similarity Unify Design

Date: 2026-07-10  
Project: Sprite-Animator  
Scope: Unify background detection for normalize + chroma key; switch similarity to chroma-space distance; add guided-sheet simplified path

## 1. Problem Statement

Background removal today uses **two incompatible “is this chroma?” rules**:

1. `utils/normalizeChromaBackground.ts` — permissive RGB heuristics (`isPureGreen`, `isNeonMagenta`, Euclidean distance to target, etc.) to snap AI color variants to exact key RGB.
2. `utils/chromaKeyCore.ts` — HSL + RGB Euclidean distance + connectivity flood-fill + clothing/hole special cases + despill.

Callers run normalize then key (`processSheetChromaKey`). Divergent thresholds cause over-aggressive snap, leftover fringes, or accidental removal of character greens/magentas. `CHROMA_KEY_FUZZ = 35` (RGB) is wide because brightness variation is mixed into the distance. Guided grid sheets already guarantee connected gutters, but still run the full aggressive hole/clothing path.

## 2. Locked Decisions (from stakeholder)

| Decision | Choice |
|----------|--------|
| Scope | All three: unify detection + chroma distance + guided simplify |
| Success bar | Quality-first (allow retuning constants; fewer fringes, less character damage) |
| Guided trigger | Explicit `guided` flag **or** auto-detect regular gutters; flag wins (`guided: false` disables auto) |
| Approach | Shared similarity module + chroma distance (not “normalize-only exact key”, not full core rewrite) |

## 3. Objectives and Non-Objectives

### Objectives

1. Single shared chroma-likeness API used by normalize and key (same formula, two thresholds).
2. Similarity based on **YCbCr chroma distance** (Cb/Cr only; ignore Y) relative to the key color.
3. Guided path: skip aggressive hole/clothing specials when flag or auto-detect says so.
4. Keep outer APIs stable (`removeChromaKeyWithWorker`, `processSheetChromaKey`); add optional `guided`.
5. Vitest coverage for similarity, normalize, key (including guided vs full), plus hard cases (skin, blue cloth, blush, green prop not edge-connected).

### Non-Objectives

- AI matting (rembg / U2-Net / BiRefNet)
- Rewriting the entire despill / edge-blend stack from scratch
- Changing Worker message protocol beyond optional `guided`
- GPU / WebGL acceleration
- New UI for fuzz (existing controls may map onto new constants later)

## 4. Architecture

### 4.1 New module: `utils/chromaSimilarity.ts`

Pure functions, no DOM:

| Export | Role |
|--------|------|
| `rgbToYCbCr(r,g,b)` | Standard BT.601-style Y, Cb, Cr |
| `chromaDistanceToKey(r,g,b, keyRgb)` | Brightness-invariant: `√((Cb/Y−Cb_k/Y_k)² + (Cr/Y−Cr_k/Y_k)²) × 128` (raw Cb/Cr scale with Y for pure greens; Y-normalize + scale keeps design thresholds 55/38 meaningful) |
| `isChromaLike(r,g,b, keyRgb, mode)` | `mode: 'normalize' \| 'key'` |
| `CHROMA_LIKE_NORMALIZE_MAX` | Default **55** |
| `CHROMA_LIKE_KEY_MAX` | Default **38** |
| Soft-edge band | Key max **+12** (eligible for soft alpha when near confirmed background; includes hard matches — callers must not treat as “outside hard mask only”) |

**Direction gate (cheap, after distance):** green key → G-dominant; magenta key → high R/B and low G. Prevents skin/gray false positives when distance alone is ambiguous.

### 4.2 Data flow (unchanged outer order)

```
processSheetChromaKey / browser normalize
  → normalizeChromaBackgroundInPlace
       uses isChromaLike(..., 'normalize') → snap to exact key RGB
  → processChromaKey
       uses isChromaLike(..., 'key') → similarityMask
       → connectivity flood-fill (existing seeds: corners, edges, center grid)
       → alpha / soft edge / despill / edge blend
       → if guided: skip aggressive hole + clothing specials; stricter island size
```

### 4.3 Call-site wiring

- `normalizeChromaBackground.ts`: replace heuristic pile with `isChromaLike`; keep `normalizeChromaBackgroundInPlace` signature (tolerance arg may map to normalize max or be deprecated in favor of constants).
- `chromaKeyCore.ts`: build `similarityMask` from shared API; remove duplicate RGB/HSL “like” gates where superseded; accept `options.guided?: boolean`.
- `nodeImage.processSheetChromaKey(image, color, { guided? })`.
- LINE / sheet generation: pass `guided: true` when using guided template.
- Browser sticker/sprite flows: same when guided template is active.
- Auto-detect (no flag): light check — corners + gutter samples mostly chroma-like and continuous seam bands; if uncertain → full path. `guided: false` forces full path.

### 4.4 Guided simplify rules

When guided is active:

- **Disable** non-connected “certain hole” forced near-transparent treatment.
- **Disable / greatly relax** clothing-direction special cases (blue-edge / blush-style gates that fight the shared detector).
- **Stricter** island removal (only tiny noise; do not swallow small in-cell props).
- **Keep** connectivity, chroma similarity, light soft edge, existing despill/edge blend (strength may be slightly reduced).

## 5. Constants and legacy fuzz

- Primary knobs live in `chromaSimilarity.ts` (`CHROMA_LIKE_*`).
- `CHROMA_KEY_FUZZ` in `constants.ts`: either map UI percent onto key chroma max, or mark deprecated with a thin adapter so existing callers do not break.
- Quality-first: constants may be retuned during implementation against hard-case tests; document final values in the PR / plan notes.

## 6. Testing and acceptance

### Unit tests

1. **`chromaSimilarity.test.ts`** — pure green/magenta; AI dark/bright variants; skin, gray, blue cloth, blush not like; same hue different Y still like.
2. **`normalizeChromaBackground.test.ts`** — variant snap, skip transparent, keep foreground (updated expectations if needed).
3. **`chromaKeyCore.test.ts`** — existing green+red center; green prop not edge-connected preserved on full path; `guided: true` does not hole-punch; fringe despill reduces chroma contrast on synthetic edges.

### Acceptance

- Full vitest green.
- Re-run chroma on a guided sheet (e.g. `twice-7-school-daily`): clean gutters, no obvious color fringe, character chroma accents not wiped.
- Spot-check non-guided remove-background path: not worse than current.

## 7. Error handling and compatibility

- Invalid / missing key color: fall back to `CHROMA_KEY_COLORS` for the requested type (existing behavior).
- Auto-detect failure → full path (safe default).
- No breaking change to public Promise/base64 Worker API; optional fields only.

## 8. Implementation order (for plan)

1. Add `chromaSimilarity.ts` + tests (TDD).
2. Point normalize at shared API; update normalize tests.
3. Point `processChromaKey` similarity + soft edge at shared API; retune; hard-case tests.
4. Add `guided` option + auto-detect helper; wire LINE/sheet callers.
5. Deprecate/adapt `CHROMA_KEY_FUZZ`; run full suite + guided sheet smoke.

## 9. Out of scope follow-ups

- Visual before/after UI for normalization stats
- Custom chroma colors beyond green/magenta
- Further despill rewrite if fringes remain after chroma unify
