/**
 * Browser-only: draw LINE sticker phrase text onto a sliced frame (data URL PNG).
 * Used when textRendering is programmatic so the image model omits text.
 */

import {
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  getLineStickerTextPlacementLabel,
} from './lineStickerPrompt';

type FontPresetKey = keyof typeof FONT_PRESETS;
type TextColorPresetKey = keyof typeof TEXT_COLOR_PRESETS;

const HEX_IN_PROMPT = /#([0-9A-Fa-f]{6})\b/;

/** How to pick text anchor when compositing programmatically. */
export type ProgrammaticTextPlacementMode =
  | 'cycle'
  | 'bottom_center'
  | 'top_center'
  | 'middle_center';

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
}

export const DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING: ProgrammaticTextOverlayTuning = {
  fontSizePercent: 8.5,
  edgeMarginPercent: 6,
  lineHeightMultiplier: 1.25,
  strokeScale: 1,
  placementMode: 'cycle',
  fontWeight: 700,
};

/** Resolve placement label for layout (matches v2 cycle or fixed anchors). */
export function resolveProgrammaticPlacementLabel(
  frameIndex: number,
  mode: ProgrammaticTextPlacementMode
): string {
  if (mode === 'cycle') {
    return getLineStickerTextPlacementLabel(frameIndex);
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

/** Approximate system stacks for canvas (cannot match model-only decorative fonts). */
export function fontCssStackForPreset(fontKey: FontPresetKey): string {
  const stacks: Record<FontPresetKey, string> = {
    handwritten:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", "Noto Sans TC", sans-serif',
    round: '"Segoe UI", "PingFang TC", "Hiragino Maru Gothic ProN", "Microsoft JhengHei", sans-serif',
    bold: '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", "Noto Sans TC", sans-serif',
    cute: '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    pop: '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    pinkBubble:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    thinHandwritten:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    catEar: '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    crayon: '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    stitched: '"Consolas", "Segoe UI", "PingFang TC", monospace',
    puffyCloud:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    cherryBlossom:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", serif',
    animalPartners:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    pastel3d:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    bobaPearl:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    neonGlow:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    marshmallowCloud:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    pixelRetro: '"Consolas", "Courier New", monospace',
    rainbowConfetti:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    chalkboard:
      '"Segoe UI", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", sans-serif',
    comicBook:
      '"Impact", "Segoe UI", "PingFang TC", "Arial Black", "Microsoft JhengHei", sans-serif',
  };
  return stacks[fontKey] ?? stacks.handwritten;
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
        const fontFamily = fontCssStackForPreset(options.fontKey);
        ctx.font = `${tuning.fontWeight} ${fontSize}px ${fontFamily}`;

        const fillHex = extractFillHexFromTextColorPreset(options.colorKey);
        const strokeHex = strokeColorForFill(fillHex);
        const placementLabel = resolveProgrammaticPlacementLabel(
          options.frameIndex,
          tuning.placementMode
        );
        const layout = layoutFromPlacementLabel(placementLabel, w, h, marginRatio);

        ctx.textAlign = layout.textAlign;
        ctx.textBaseline = layout.textBaseline;
        const lineHeight = fontSize * lineMult;
        const lines = wrapLines(ctx, trimmed, layout.maxWidth);
        const totalTextHeight = lines.length * lineHeight;

        let startY = layout.anchorY;
        if (layout.textBaseline === 'bottom') {
          startY = layout.anchorY - (lines.length - 1) * lineHeight;
        } else if (layout.textBaseline === 'middle') {
          startY = layout.anchorY - totalTextHeight / 2 + lineHeight / 2;
        }

        const strokeW = Math.max(1.5, fontSize * 0.12 * strokeMult);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        lines.forEach((line, i) => {
          const y = startY + i * lineHeight;
          ctx.strokeStyle = strokeHex;
          ctx.lineWidth = strokeW * 2;
          ctx.strokeText(line, layout.anchorX, y);
          ctx.fillStyle = fillHex;
          ctx.fillText(line, layout.anchorX, y);
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
