# Canvas Compose Sticker Layout Design

Date: 2026-07-11  
Project: Sprite-Animator  
Scope: New programmatic text pipeline — compose character + caption on a fresh canvas with guaranteed non-overlap, then fit to LINE sticker limits

## 1. Problem Statement

The current programmatic overlay path:

```
slice cell → overlayPhraseOnRgbaFrame (text on full cell) → trimFrameToContent → sticker-XX.png
```

relies on `auto_avoid_subject` / band search + optional font shrink (`fontSizeMode: 'auto'`). At **22–24%** `fontSizePercent` with `fixed` mode, captions still overlap the character on many frames because:

1. Font size is measured against the **post-trim** frame, which varies per sticker.
2. Placement searches inside the same raster as the character; overlap is minimized, not forbidden.
3. Large glyphs can extend outside the caption band rect while the anchor stays “legal.”

**Goal:** A second rendering strategy that **allocates disjoint regions** for subject and text on a working canvas, then **uniformly scales** the result to LINE upload bounds (370×320 max, even dimensions).

## 2. Locked Decisions (proposed defaults)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Delivery | New compose mode alongside existing overlay | Zero breaking change; jobs opt in |
| Working canvas | **370×320** (LINE max), transparent RGBA | Same coordinate system as `prepareLineStickerFrame`; `fontSizePercent` is stable across the set |
| Font sizing | `fontSizePercent` of `min(canvasW, canvasH)`; default **22%**, `fontSizeMode: 'fixed'` | Matches husky reference (~22–24%); no binary-search shrink in compose mode |
| Overlap rule | **Hard partition** — text glyphs must stay inside caption slot; subject pixels inside subject slot only | Overlap impossible by construction |
| Subject input | Chroma-keyed slice **before** overlay (trim optional, see §5.3) | Reuse existing slice output |
| Final export | `resizeToFitWithin(370, 320)` only if working canvas exceeds limits; with 370×320 work canvas, output is already compliant | Reuse `computeFitDimensions` / `prepareLineStickerFrame` |
| Default layout (v1) | `top_caption_bottom_subject` | Aligns with `RESERVED_CAPTION_BAND_HEIGHT_RATIO = 0.28` and generation prompt “top ~28% clear” |
| Per-frame layout | `generation_aligned` optional preset — map `getReservedCaptionBandLabelForFrame(i)` → layout preset | Keeps variety across 40 cells without manual overrides |

## 3. Objectives and Non-Objectives

### Objectives

1. Introduce `composeStickerFrame(subject, phrase, options)` returning RGBA ready for `sticker-XX.png`.
2. Ship **5 layout presets** (§6) with documented slot geometry.
3. Wire into `sheetGeneration.mts`, `reoverlay-sheet.mts`, browser preview hooks.
4. Extend `job.config.json` with `programmaticCompose` block (layout, tuning).
5. Vitest: slot rects disjoint; text bbox ⊆ caption slot; subject bbox ⊆ subject slot; output dimensions ≤ LINE max and even.
6. Preview script for 3 sample stickers (e.g. sticker-03, 11, 07) before full-set reoverlay.

### Non-Objectives (v1)

- Saliency / ML subject detection
- Changing Gemini generation prompts (compose works with existing sheets; prompt tuning is follow-up)
- Replacing or removing `auto_avoid_subject` overlay path
- Animated stickers
- Per-glyph collision with non-rectangular subject masks (slots are rectangular; subject is **fitted**, not free-placed)

## 4. Architecture

### 4.1 Pipeline comparison

**Current (`textRendering: 'programmatic'`, compose off):**

```
slice → overlay on cell → trimFrameToContent
```

**New (`textRendering: 'programmatic'`, `composeLayout` set):**

```
slice → [optional] trim subject only OR use full cell content bbox
     → composeStickerFrame on 370×320 work canvas
     → [optional] light trim (5% margin) OR skip trim
     → prepareLineStickerFrame (no-op if already ≤370×320)
```

### 4.2 New module: `utils/lineStickerComposeLayout.ts`

Pure layout + metrics (no canvas I/O):

| Export | Role |
|--------|------|
| `ComposeLayoutPreset` | Union of preset ids (§6) |
| `WORK_CANVAS_WIDTH` / `WORK_CANVAS_HEIGHT` | 370 / 320 |
| `resolveComposeSlots(preset, canvasW, canvasH, marginRatio)` | `{ captionSlot, subjectSlot }` as `PixelRect` |
| `fitSubjectIntoSlot(subjectBounds, slot)` | Scale + offset (contain, bottom/center anchor per preset) |
| `captionFontSizePx(canvas, tuning)` | `round(min(W,H) * fontSizePercent/100)` |
| `layoutCaptionInSlot(ctx, phrase, slot, tuning)` | Wrap lines, center in slot; **clip** to slot if needed |
| `mapBandLabelToComposePreset(label)` | For `generation_aligned` |

### 4.3 Rendering: `composeStickerFrame` 

Location: `utils/lineStickerCompose.ts` (shared) + thin wrappers in:

- `.claude/skills/line-sticker-maker/scripts/programmaticTextOverlay.mts` (headless)
- `utils/lineStickerTextOverlay.ts` (browser)

Steps:

1. Measure subject opaque bbox from input RGBA (reuse trim bbox logic or `trimFrameToContent` with `marginRatio: 0`).
2. Allocate transparent 370×320 canvas.
3. Blit scaled subject into `subjectSlot`.
4. Render caption into `captionSlot` (stroke + fill; same font/color resolution as overlay).
5. Return RGBA.

### 4.4 Configuration

```ts
// job.config.json (new fields)
{
  "textRendering": "programmatic",
  "programmaticCompose": {
    "enabled": true,
    "layout": "top_caption_bottom_subject",  // or "generation_aligned"
    "workCanvas": { "width": 370, "height": 320 },
    "subjectFit": "contain",                 // v1 only
    "subjectAnchor": "bottom_center",        // per-preset default; overridable
    "trimAfterCompose": false,               // default: keep fixed canvas size
    "tuning": {
      "fontSizePercent": 22,
      "fontSizeMode": "fixed",
      "edgeMarginPercent": 6,
      "lineHeightMultiplier": 1.25,
      "strokeScale": 1
    }
  }
}
```

When `programmaticCompose.enabled === true`, **ignore** `placementMode` / `auto_avoid_subject` for that job. `programmaticTextTuning` merges with `programmaticCompose.tuning` (compose block wins).

### 4.5 Integration points

| File | Action |
|------|--------|
| `sheetGeneration.mts` | Branch: compose vs overlay after slice |
| `reoverlay-sheet.mts` | Same branch for regeneration |
| `generate.mts` | Pass `programmaticCompose` from job config |
| `preview-programmatic-font-sizes.mts` | Add `--compose` flag |
| `lineStickerTextOverlayTypes.ts` | Add `ProgrammaticComposeConfig` type |
| `hooks/useLineStickerProgrammaticOverlay.ts` | Optional compose preview |

## 5. Layout Geometry Rules (global)

- **Margin** `m = edgeMarginPercent% × min(W,H)` applied inside work canvas on all slots.
- **Caption slot** height for band layouts: `bandH = 0.28 × (H - 2m)` — matches `RESERVED_CAPTION_BAND_HEIGHT_RATIO`.
- **Side strip** width: `0.22 × (W - 2m)` — matches `captionBandPixelRectForLabel` beside-head strips.
- **Subject fit:** `contain` inside subject slot; default anchor per preset (usually bottom-center or center).
- **Long phrases (5 chars):** wrap inside caption slot width; if still overflow height, reduce font **only for that frame** down to min 16px (compose-local emergency shrink, not global auto mode).
- **Empty phrase:** subject only, centered on full canvas (minus margins).

### 5.1 Slot disjointness invariant

```
captionSlot ∩ subjectSlot = ∅   (pixel rects, inclusive edges)
```

Enforced in unit tests for every preset at 370×320 and at 200×200 (stress small canvas).

### 5.2 Font metrics

- Base size: `fontSizePercent` of `min(workCanvasW, workCanvasH)`.
- At 370×320, 22% → **~70px** font (vs ~19–22px on typical trimmed stickers today) — intentional; final LINE chat display scales down uniformly.

### 5.3 Subject trim policy

| Option | When |
|--------|------|
| `subjectTrim: 'none'` (default) | Use full cell slice; fit into subject slot |
| `subjectTrim: 'content'` | `trimFrameToContent` before compose; character larger in slot but may clip pose extremities |

Recommend **`none` for v1** on `twice-1-school-daily` — generation already leaves caption bands empty.

## 6. Layout Presets (recommended options)

### Preset A — `top_caption_bottom_subject` ⭐ Recommended default

```
┌──────────────────────── 370 ────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓ CAPTION SLOT 28% ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ 320
├─────────────────────────────────────────────────────┤
│                                                     │
│              SUBJECT SLOT 72%                       │
│         (contain, bottom-center anchor)             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

| | |
|--|--|
| **Best for** | Daily chat, school set, husky-style top copy |
| **Generation alignment** | Top band clear — matches many `Top center` / `Top left` reserved bands |
| **Pros** | Predictable; 22% font reads large; no face overlap |
| **Cons** | Character ~15–25% smaller vs overlay+trim workflow |

---

### Preset B — `bottom_caption_top_subject`

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              SUBJECT SLOT 72%                       │
│         (contain, top-center anchor)                │
│                                                     │
├─────────────────────────────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓ CAPTION SLOT 28% ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└─────────────────────────────────────────────────────┘
```

| | |
|--|--|
| **Best for** | Classic meme / reaction stickers, “punchline below face” |
| **Generation alignment** | `Bottom center` reserved bands (common in cycle) |
| **Pros** | Face reads first in chat bubble flow |
| **Cons** | Caption closer to chat UI chrome on some clients |

---

### Preset C — `side_caption_left_subject_right`

```
┌──────────┬──────────────────────────────────────────┐
│ CAPTION  │                                          │
│  SLOT    │           SUBJECT SLOT                   │
│  22% W   │              78% W                       │
│  mid     │         (contain, center-right)          │
│  height  │                                          │
└──────────┴──────────────────────────────────────────┘
```

| | |
|--|--|
| **Best for** | Short 2–3 char phrases, headshot compositions |
| **Generation alignment** | `Beside head (left)` — text left, character right |
| **Pros** | Character stays tall; good for portrait poses |
| **Cons** | 5-char phrases need narrow font or wrap; left strip feels tight at 22% font |

---

### Preset D — `side_caption_right_subject_left`

Mirror of Preset C. Aligns with `Beside head (right)` reserved bands.

---

### Preset E — `corner_top_left_subject_bottom_right`

```
┌─────────────────────────────────────────────────────┐
│ CAPTION │                                           │
│  ~40%   │                                           │
│  W×28%H │         SUBJECT SLOT                      │
│         │    (contain, bottom-right anchor)         │
│         │                                           │
└─────────────────────────────────────────────────────┘
```

| | |
|--|--|
| **Best for** | Dramatic reactions (sticker-11 太扯了吧), diagonal energy |
| **Generation alignment** | `Top left` + character biased lower-right |
| **Pros** | Dynamic; matches shocked face + exclamation |
| **Cons** | Less uniform across 40 cells; subject smaller in corner |

---

### Preset F — `generation_aligned` ⭐ Recommended for full 40-set

Not a single geometry — **per-frame resolver**:

| Reserved band label (from prompt) | Compose preset |
|-----------------------------------|----------------|
| Top center / Top left / Top right | A or E (top band family) |
| Bottom center / Bottom left / Bottom right | B |
| Beside head (left) | C |
| Beside head (right) | D |
| Middle center | **A with 28% middle horizontal band** (variant `middle_band`) |
| Diagonal lower-right | E |

Cycle preserves existing phrase-to-band variety without re-running Gemini.

**v1 implementation note:** Ship A, B, C, D, E as explicit presets; implement F as thin mapper calling the same slot functions.

---

### Preset comparison matrix

| Preset | Uniform 40-set | 22% font safe | Character size | Matches current prompt bands |
|--------|----------------|---------------|----------------|------------------------------|
| A top/bottom | ★★★★★ | ★★★★★ | ★★★☆☆ | Top bands |
| B bottom/top | ★★★★☆ | ★★★★★ | ★★★☆☆ | Bottom bands |
| C side L | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | Side L |
| D side R | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | Side R |
| E corner | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ | Top-left + diag |
| F generation_aligned | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ |

## 7. Recommendation for `twice-1-school-daily`

**Phase 1 spike (3 stickers):** Preset **A** + `fontSizePercent: 22`, `trimAfterCompose: false`.

**Phase 2 full set:** Switch to **F (`generation_aligned`)** if A-only feels too uniform; otherwise keep A for brand consistency (all top copy like reference husky).

**Do not** change `fontSizeMode` to `auto` in compose mode.

## 8. Impact Analysis

### Modules

| Action | Module | Notes |
|--------|--------|-------|
| **新增** | `utils/lineStickerComposeLayout.ts` | Slot math, preset resolver |
| **新增** | `utils/lineStickerCompose.ts` | Canvas compose orchestration |
| **新增** | `utils/lineStickerCompose.test.ts` | Disjoint slots, bbox tests |
| **修改** | `utils/lineStickerTextOverlayTypes.ts` | `ProgrammaticComposeConfig` |
| **修改** | `programmaticTextOverlay.mts` | `composeStickerFrame`, branch |
| **修改** | `sheetGeneration.mts` | Compose branch |
| **修改** | `reoverlay-sheet.mts` | Compose branch |
| **修改** | `generate.mts` | Config passthrough |
| **修改** | `preview-programmatic-font-sizes.mts` | `--compose` |
| **參考** | `lineStickerUploadSpec.ts` | `computeFitDimensions`, limits |
| **參考** | `nodeImage.prepareLineStickerFrame` | Final fit |
| **參考** | `lineStickerTextOverlayGeometry.ts` | Band ratios 0.28 / 0.22 |
| **參考** | `sheetComponentSlicer.trimFrameToContent` | Optional subject trim |

### Behavioral changes

- Sticker PNG dimensions become **more uniform** (often exactly 370×320 or proportional fit).
- Manifest `width`/`height` fields will cluster; upload pack sizing more predictable.
- QA `edgeGreenCount` unchanged (compose is post-chroma).
- Browser animator preview should show compose when config enabled.

## 9. Acceptance Criteria

1. With `programmaticCompose.enabled: true`, reoverlay produces 40 stickers with **zero** caption/subject pixel overlap (test: caption slot alpha only in caption region when subject removed, and vice versa).
2. All output frames satisfy `width ≤ 370`, `height ≤ 320`, even dimensions.
3. Fixed 22% font on 370×320 canvas produces visually larger captions than legacy overlay at 22% on trimmed frames (snapshot test on sticker-11 phrase `太扯了吧`).
4. Presets A–E each pass disjoint-slot unit tests at default margins.
5. `generation_aligned` maps frame 0..39 without throw; preset distribution matches band labels.
6. Existing jobs **without** `programmaticCompose` behave identically (regression: `lineStickerTextOverlay.test.ts`).

## 10. Task Breakdown (develop order)

| # | Task | Est. |
|---|------|------|
| 1 | `lineStickerComposeLayout.ts` — rects + preset A/B | 30m |
| 2 | Presets C/D/E + `mapBandLabelToComposePreset` | 30m |
| 3 | `lineStickerCompose.ts` — subject fit + caption draw | 45m |
| 4 | Unit tests (disjoint, font size, long phrase shrink) | 30m |
| 5 | Wire `sheetGeneration` + `reoverlay-sheet` | 20m |
| 6 | Job config types + `generate.mts` | 15m |
| 7 | Preview script `--compose` on sticker-03/11/07 | 15m |
| 8 | Human visual pass → tune `fontSizePercent` 22 vs 24 | — |

## 11. Open Questions (resolve before or during spike)

1. **Subject trim default:** `none` vs `content` for school-daily set?
2. **Middle center band:** separate preset `middle_band` or fold into F only?
3. **Post-compose trim:** keep strict 370×320 for LINE preview consistency, or trim transparent edges for smaller file size?
4. **Browser parity:** required for v1 or headless-only first?

---

## Appendix: ASCII — End-to-end data flow

```
_raw-sheet.jpg
    → chroma (forge)
    → slice (guided template)
    → composeStickerFrame  ──► 370×320 RGBA (caption + subject slots)
    → prepareLineStickerFrame (identity if already in bounds)
    → sticker-XX.png
    → finalize / line-upload.zip
```
