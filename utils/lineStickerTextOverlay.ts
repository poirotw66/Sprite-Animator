/**
 * Browser-only: draw LINE sticker phrase text onto a sliced frame (data URL PNG).
 * Used when textRendering is programmatic so the image model omits text.
 */

import {
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  getLineStickerTextPlacementLabel,
  LINE_STICKER_TEXT_PLACEMENT_PRESETS,
} from './lineStickerPrompt';

type FontPresetKey = keyof typeof FONT_PRESETS;
type TextColorPresetKey = keyof typeof TEXT_COLOR_PRESETS;

const HEX_IN_PROMPT = /#([0-9A-Fa-f]{6})\b/;

/** How to pick text anchor when compositing programmatically. */
export type ProgrammaticTextPlacementMode =
  | 'cycle'
  | 'bottom_center'
  | 'top_center'
  | 'middle_center'
  /** Pick a preset corner/edge from raster so caption avoids opaque subject bbox. */
  | 'auto_avoid_subject';

/** How to resolve canvas font-family for programmatic overlay. */
export type ProgrammaticFontFamilySource = 'preset' | 'custom';

/** User-tunable overlay parameters (LINE sticker programmatic text mode). */
export interface ProgrammaticTextOverlayTuning {
  /** Font size as percent of min(frame width, height), e.g. 8.5 => 0.085 multiplier. */
  fontSizePercent: number;
  /** Edge inset for text box, percent of min(frame width, height). */
  edgeMarginPercent: number;
  /** Line height as multiple of font size. */
  lineHeightMultiplier: number;
  /** Multiplier for auto stroke width. */
  strokeScale: number;
  placementMode: ProgrammaticTextPlacementMode;
  fontWeight: 400 | 500 | 600 | 700;
  /** Shift text anchor horizontally (% of frame width, negative = left). */
  offsetXPercent: number;
  /** Shift text anchor vertically (% of frame height, negative = up). */
  offsetYPercent: number;
  fontFamilySource: ProgrammaticFontFamilySource;
  /** When fontFamilySource is custom: CSS font-family list (e.g. "Noto Sans TC", sans-serif). */
  customFontFamily: string;
  /**
   * Optional per-frame placement mode. Index matches sticker frame; null/undefined = use placementMode.
   */
  placementModeOverrides?: (ProgrammaticTextPlacementMode | null)[];
}

export const DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING: ProgrammaticTextOverlayTuning = {
  fontSizePercent: 8.5,
  edgeMarginPercent: 6,
  lineHeightMultiplier: 1.25,
  strokeScale: 1,
  placementMode: 'cycle',
  fontWeight: 700,
  offsetXPercent: 0,
  offsetYPercent: 0,
  fontFamilySource: 'preset',
  customFontFamily: '"Noto Sans TC", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
};

/** Effective placement mode for a frame (global mode or per-frame override). */
export function getEffectiveProgrammaticPlacementMode(
  tuning: ProgrammaticTextOverlayTuning,
  frameIndex: number
): ProgrammaticTextPlacementMode {
  const override = tuning.placementModeOverrides?.[frameIndex];
  return override ?? tuning.placementMode;
}

/**
 * Resolve placement label for layout (cycle, fixed anchors). Does not handle auto_avoid_subject;
 * that mode is resolved in overlayLineStickerTextOnFrame after raster analysis.
 */
export function resolveProgrammaticPlacementLabel(
  frameIndex: number,
  tuning: ProgrammaticTextOverlayTuning
): string {
  const mode = getEffectiveProgrammaticPlacementMode(tuning, frameIndex);
  if (mode === 'cycle') {
    return getLineStickerTextPlacementLabel(frameIndex);
  }
  if (mode === 'auto_avoid_subject') {
    return 'Bottom center';
  }
  if (mode === 'bottom_center') return 'Bottom center';
  if (mode === 'top_center') return 'Top center';
  return 'Middle center';
}

/** Extract #RRGGBB from preset promptDesc (e.g. "Black #000000"). */
export function extractFillHexFromTextColorPreset(colorKey: TextColorPresetKey): string {
  const desc = TEXT_COLOR_PRESETS[colorKey]?.promptDesc ?? '';
  const m = desc.match(HEX_IN_PROMPT);
  return m ? `#${m[1]}` : '#000000';
}

function luminance(hex: string): number {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** High-contrast stroke for sticker readability on transparent / chroma backgrounds. */
export function strokeColorForFill(fillHex: string): string {
  return luminance(fillHex) > 0.55 ? '#1a1a1a' : '#ffffff';
}

/**
 * System font stacks for canvas. The browser uses the first installed family.
 * Stacks are chosen to approximate each FONT_PRESETS prompt (not decorative
 * model-only effects). Several "rounded bubble" styles share the same nearest
 * system round sans; they stay honest to that limit rather than forcing odd faces.
 */
export function fontCssStackForPreset(fontKey: FontPresetKey): string {
  const stacks: Record<FontPresetKey, string> = {
    handwritten:
      '"Kaiti TC", "DFKai-SB", "BiauKai", "Bradley Hand ITC", "Microsoft JhengHei", sans-serif',
    round:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei UI", "PingFang TC", sans-serif',
    bold:
      '"Heiti TC", "STHeiti", "PingFang TC", "Microsoft JhengHei", "Hiragino Sans", "Noto Sans TC", sans-serif',
    cute:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Chalkboard SE", "Microsoft JhengHei", "PingFang TC", sans-serif',
    pop:
      '"PingFang TC", "Hiragino Sans", "Microsoft JhengHei", "Helvetica Neue", "Segoe UI", sans-serif',
    pinkBubble:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei UI", "PingFang TC", sans-serif',
    thinHandwritten:
      '"Bradley Hand ITC", "Snell Roundhand", "Kaiti TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    catEar:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "PingFang TC", "Microsoft JhengHei", sans-serif',
    crayon:
      '"Marker Felt", "Chalkduster", "Kaiti TC", "DFKai-SB", "PingFang TC", fantasy',
    stitched: '"Consolas", "Menlo", "Monaco", "Courier New", monospace',
    puffyCloud:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei", sans-serif',
    cherryBlossom:
      '"Hiragino Mincho ProN", "Songti TC", "Yu Mincho", "PMingLiU", "Georgia", serif',
    animalPartners:
      '"Chalkboard SE", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "PingFang TC", sans-serif',
    pastel3d:
      '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Microsoft JhengHei", sans-serif',
    bobaPearl:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei", sans-serif',
    neonGlow:
      '"Impact", "Arial Black", "Bahnschrift", "PingFang TC", "Microsoft JhengHei", sans-serif',
    marshmallowCloud:
      '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", "Microsoft JhengHei", sans-serif',
    pixelRetro: '"Courier New", "Consolas", "Monaco", "Menlo", monospace',
    rainbowConfetti:
      '"Arial Black", "Impact", "Hiragino Maru Gothic ProN", "Microsoft JhengHei", sans-serif',
    chalkboard:
      '"Chalkduster", "Marker Felt", "Kaiti TC", "DFKai-SB", "PingFang TC", fantasy',
    comicBook:
      '"Impact", "Arial Black", "Helvetica Neue", "PingFang TC", "Microsoft JhengHei", fantasy',
  };
  return stacks[fontKey] ?? stacks.handwritten;
}

/**
 * Numeric weight for canvas `font`. Some presets bias lighter so the glyph matches
 * the prompt (e.g. thin hand-drawn) without ignoring the user's weight control.
 */
export function resolveCanvasFontNumericWeight(
  fontKey: FontPresetKey,
  tuning: ProgrammaticTextOverlayTuning
): number {
  const w = tuning.fontWeight;
  if (fontKey === 'thinHandwritten') {
    return Math.min(w, 600);
  }
  return w;
}

/** Canvas `font` family stack: preset keys or custom CSS from tuning. */
export function resolveProgrammaticFontFamilyCss(
  fontKey: FontPresetKey,
  tuning: ProgrammaticTextOverlayTuning
): string {
  if (tuning.fontFamilySource === 'custom' && tuning.customFontFamily.trim().length > 0) {
    return tuning.customFontFamily.trim();
  }
  return fontCssStackForPreset(fontKey);
}

export interface TextPlacementLayout {
  anchorX: number;
  anchorY: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  maxWidth: number;
}

/**
 * Map v2-style placement label to canvas anchor and max line width (fraction of cell).
 * `edgeMarginRatio` is 0–0.25 (e.g. 0.06 = 6% inset on each side).
 */
export function layoutFromPlacementLabel(
  label: string,
  width: number,
  height: number,
  edgeMarginRatio: number = 0.06
): TextPlacementLayout {
  const margin = Math.max(0.02, Math.min(0.22, edgeMarginRatio));
  const marginX = width * margin;
  const marginY = height * margin;
  const maxW = width - marginX * 2;
  const lower = label.toLowerCase();

  let textAlign: CanvasTextAlign = 'center';
  let textBaseline: CanvasTextBaseline = 'bottom';
  let anchorX = width / 2;
  let anchorY = height - marginY;

  if (lower.includes('middle center')) {
    textAlign = 'center';
    textBaseline = 'middle';
    anchorX = width / 2;
    anchorY = height / 2;
  } else if (lower.includes('top center')) {
    textBaseline = 'top';
    anchorY = marginY;
  } else if (lower.includes('bottom center')) {
    textBaseline = 'bottom';
    anchorY = height - marginY;
  } else if (lower.includes('top left')) {
    textAlign = 'left';
    textBaseline = 'top';
    anchorX = marginX;
    anchorY = marginY;
  } else if (lower.includes('top right')) {
    textAlign = 'right';
    textBaseline = 'top';
    anchorX = width - marginX;
    anchorY = marginY;
  } else if (lower.includes('bottom left')) {
    textAlign = 'left';
    textBaseline = 'bottom';
    anchorX = marginX;
    anchorY = height - marginY;
  } else if (lower.includes('bottom right')) {
    textAlign = 'right';
    textBaseline = 'bottom';
    anchorX = width - marginX;
    anchorY = height - marginY;
  } else if (lower.includes('diagonal') || lower.includes('beside head')) {
    textAlign = 'center';
    textBaseline = 'middle';
    anchorX = width / 2;
    anchorY = height * 0.72;
  }

  return { anchorX, anchorY, textAlign, textBaseline, maxWidth: maxW };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  const pushWord = (word: string) => {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
      return;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      return;
    }
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (ctx.measureText(next).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    line = chunk;
  };

  for (const w of words) {
    pushWord(w);
  }
  if (line) lines.push(line);

  if (lines.length === 0) return [trimmed];
  return lines;
}

/** Axis-aligned rectangle in pixel space. */
export type PixelRect = { minX: number; minY: number; maxX: number; maxY: number };

export function rectangleIntersectionArea(a: PixelRect, b: PixelRect): number {
  const iw = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const ih = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (iw <= 0 || ih <= 0) return 0;
  return iw * ih;
}

/** Minimum gap between two non-overlapping axis-aligned rectangles (0 if overlapping). */
export function rectangleMinSeparation(a: PixelRect, b: PixelRect): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

/**
 * Rough bounding box for multi-line sticker text from anchor, alignment, and line metrics.
 */
export function estimateTextBlockBox(
  width: number,
  height: number,
  layout: TextPlacementLayout,
  lineCount: number,
  lineHeight: number
): PixelRect {
  const totalH = Math.max(lineHeight, lineCount * lineHeight);
  let top = layout.anchorY;
  let bottom = layout.anchorY;
  if (layout.textBaseline === 'bottom') {
    bottom = layout.anchorY;
    top = layout.anchorY - totalH;
  } else if (layout.textBaseline === 'top') {
    top = layout.anchorY;
    bottom = layout.anchorY + totalH;
  } else {
    top = layout.anchorY - totalH / 2;
    bottom = layout.anchorY + totalH / 2;
  }

  let left = layout.anchorX;
  let right = layout.anchorX;
  const mw = layout.maxWidth;
  if (layout.textAlign === 'left') {
    left = layout.anchorX;
    right = layout.anchorX + mw;
  } else if (layout.textAlign === 'right') {
    left = layout.anchorX - mw;
    right = layout.anchorX;
  } else {
    left = layout.anchorX - mw / 2;
    right = layout.anchorX + mw / 2;
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    minX: clamp(left, 0, width),
    minY: clamp(top, 0, height),
    maxX: clamp(right, 0, width),
    maxY: clamp(bottom, 0, height),
  };
}

function isChromaLikePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 12) return true;
  const magentaScore = Math.abs(r - 255) + Math.abs(g) + Math.abs(b - 255);
  const greenScore = Math.abs(r) + Math.abs(g - 255) + Math.abs(b);
  return magentaScore < 72 || greenScore < 72;
}

function isForegroundPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 18) return false;
  return !isChromaLikePixel(r, g, b, a);
}

/**
 * Bounding box of opaque / non-chroma pixels (downsampled). Returns null if no foreground found.
 */
export function computeSubjectBoundingBoxFromContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleStep = 2
): PixelRect | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  const step = Math.max(1, Math.min(sampleStep, Math.floor(Math.min(width, height) / 64) || 1));
  for (let y = 0; y < height; y += step) {
    const row = ctx.getImageData(0, y, width, 1);
    const d = row.data;
    for (let x = 0; x < width; x += step) {
      const i = x * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (isForegroundPixel(r, g, b, a)) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!found || maxX < minX || maxY < minY) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function pickBestPlacementLabelAutoAvoid(
  ctx: CanvasRenderingContext2D,
  trimmed: string,
  width: number,
  height: number,
  marginRatio: number,
  fontSize: number,
  lineHeight: number,
  frameIndex: number
): string {
  const subject = computeSubjectBoundingBoxFromContext(ctx, width, height);
  if (!subject) {
    return getLineStickerTextPlacementLabel(frameIndex);
  }
  let bestLabel = LINE_STICKER_TEXT_PLACEMENT_PRESETS[0] ?? 'Bottom center';
  let bestScore = -Number.MAX_VALUE;
  for (const label of LINE_STICKER_TEXT_PLACEMENT_PRESETS) {
    const layout = layoutFromPlacementLabel(label, width, height, marginRatio);
    const lines = wrapLines(ctx, trimmed, layout.maxWidth);
    const lineCount = Math.max(1, lines.length);
    const textBox = estimateTextBlockBox(width, height, layout, lineCount, lineHeight);
    const overlap = rectangleIntersectionArea(textBox, subject);
    const gap = rectangleMinSeparation(textBox, subject);
    const score = gap - overlap * 12;
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }
  return bestLabel;
}

export interface LineStickerTextOverlayOptions {
  fontKey: FontPresetKey;
  colorKey: TextColorPresetKey;
  /** Frame index in the sheet (0-based); cycles placement when mode is cycle. */
  frameIndex: number;
  tuning?: ProgrammaticTextOverlayTuning;
}

/**
 * Draw phrase on a sticker frame image. Resolves to the same data URL if phrase is empty or not in browser.
 */
export function overlayLineStickerTextOnFrame(
  frameDataUrl: string,
  phrase: string,
  options: LineStickerTextOverlayOptions
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(frameDataUrl);
  }

  const trimmed = phrase.trim();
  if (!trimmed) {
    return Promise.resolve(frameDataUrl);
  }

  const tuning = options.tuning ?? DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING;
  const sizeRatio = Math.max(0.04, Math.min(0.2, tuning.fontSizePercent / 100));
  const marginRatio = Math.max(0.02, Math.min(0.18, tuning.edgeMarginPercent / 100));
  const lineMult = Math.max(1.02, Math.min(1.8, tuning.lineHeightMultiplier));
  const strokeMult = Math.max(0.5, Math.min(2.5, tuning.strokeScale));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(frameDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);

        const fontSize = Math.max(10, Math.round(Math.min(w, h) * sizeRatio));
        const fontFamily = resolveProgrammaticFontFamilyCss(options.fontKey, tuning);
        const numericWeight = resolveCanvasFontNumericWeight(options.fontKey, tuning);
        ctx.font = `${numericWeight} ${fontSize}px ${fontFamily}`;

        const fillHex = extractFillHexFromTextColorPreset(options.colorKey);
        const strokeHex = strokeColorForFill(fillHex);
        const lineHeight = fontSize * lineMult;
        const mode = getEffectiveProgrammaticPlacementMode(tuning, options.frameIndex);
        let placementLabel: string;
        if (mode === 'auto_avoid_subject') {
          placementLabel = pickBestPlacementLabelAutoAvoid(
            ctx,
            trimmed,
            w,
            h,
            marginRatio,
            fontSize,
            lineHeight,
            options.frameIndex
          );
        } else {
          placementLabel = resolveProgrammaticPlacementLabel(options.frameIndex, tuning);
        }
        const layout = layoutFromPlacementLabel(placementLabel, w, h, marginRatio);

        const offsetX = (w * tuning.offsetXPercent) / 100;
        const offsetY = (h * tuning.offsetYPercent) / 100;
        const anchorX = layout.anchorX + offsetX;
        const anchorY = layout.anchorY + offsetY;

        ctx.textAlign = layout.textAlign;
        ctx.textBaseline = layout.textBaseline;
        const lines = wrapLines(ctx, trimmed, layout.maxWidth);
        const totalTextHeight = lines.length * lineHeight;

        let startY = anchorY;
        if (layout.textBaseline === 'bottom') {
          startY = anchorY - (lines.length - 1) * lineHeight;
        } else if (layout.textBaseline === 'middle') {
          startY = anchorY - totalTextHeight / 2 + lineHeight / 2;
        }

        const strokeW = Math.max(1.5, fontSize * 0.12 * strokeMult);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        lines.forEach((line, i) => {
          const y = startY + i * lineHeight;
          ctx.strokeStyle = strokeHex;
          ctx.lineWidth = strokeW * 2;
          ctx.strokeText(line, anchorX, y);
          ctx.fillStyle = fillHex;
          ctx.fillText(line, anchorX, y);
        });

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(frameDataUrl);
      }
    };
    img.onerror = () => reject(new Error('Sticker frame image failed to load'));
    img.src = frameDataUrl;
  });
}

/** Apply overlay to each frame when programmatic text is enabled. */
export async function overlayPhrasesOnStickerFrames(
  frames: string[],
  phrases: string[],
  opts: {
    fontKey: FontPresetKey;
    colorKey: TextColorPresetKey;
    tuning?: ProgrammaticTextOverlayTuning;
  }
): Promise<string[]> {
  const tuning = opts.tuning ?? DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING;
  const out = await Promise.all(
    frames.map((frame, i) =>
      overlayLineStickerTextOnFrame(frame, phrases[i] ?? '', {
        fontKey: opts.fontKey,
        colorKey: opts.colorKey,
        frameIndex: i,
        tuning,
      })
    )
  );
  return out;
}
