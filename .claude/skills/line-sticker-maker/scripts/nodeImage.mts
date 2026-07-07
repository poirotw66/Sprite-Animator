/**
 * Node image glue for the LINE sticker skill.
 *
 * Replaces the browser Canvas layer of the web app with pure-JS PNG handling:
 *   - decode/encode PNG via upng-js (already a project dependency, no native build)
 *   - chroma-key removal via the SHARED `processChromaKey` core (same algorithm
 *     the app's Web Worker + main-thread fallback use — imported, not copied)
 *   - background color normalization before chroma key (same rules as the web app)
 *   - slicing by integer buffer cropping at NATIVE resolution (no resampling)
 *
 * Everything here is headless: no DOM, no canvas, no React.
 */

import UPNG from 'upng-js';
import jpeg from 'jpeg-js';
import { processChromaKey } from '../../../../utils/chromaKeyCore.ts';
import { normalizeChromaBackgroundInPlace } from '../../../../utils/normalizeChromaBackground.ts';
import {
  CHROMA_KEY_COLORS,
  CHROMA_KEY_FUZZ,
  CHROMA_KEY_EDGE_BAND_RADIUS,
  CHROMA_KEY_EDGE_BLEND,
  LINE_STICKER_CELL_INSET_RATIO,
} from '../../../../utils/constants.ts';
import {
  computeOptimizedSliceFromMargins,
  measureContentMargins,
  type OptimizedSliceResult,
} from '../../../../utils/optimizeSliceSettings.ts';
import { clearEdgeConnectedResidue } from '../../../../utils/frameEdgeCleanup.ts';
import { detectSheetGridBoundaries } from '../../../../utils/sheetBoundaryDetection.ts';
import {
  detectBestGridLayoutFromRgba,
  scoreGridLayoutFromRgba,
  type GridLayoutScore,
} from '../../../../utils/sheetGridValidation.ts';
import {
  LINE_STICKER_UPLOAD,
  computeFitDimensions,
  toEvenDimension,
} from '../../../../utils/lineStickerUploadSpec.ts';
import type { ChromaKeyColorType } from '../../../../types.ts';

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** PNG magic: 89 50 4E 47. */
function isPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

/** JPEG magic: FF D8 FF. */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** File extension for a raw image buffer, by magic bytes. */
export function extForBytes(bytes: Uint8Array): string {
  if (isJpeg(bytes)) return 'jpg';
  if (isPng(bytes)) return 'png';
  return 'bin';
}

/**
 * Decode model output (PNG or JPEG) to an RGBA buffer. Gemini image models may
 * return either format, so detect by magic bytes. JPEG via jpeg-js (pure JS).
 */
export function decodeImage(bytes: Uint8Array): RgbaImage {
  if (isPng(bytes)) return decodePng(bytes);
  if (isJpeg(bytes)) {
    const raw = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return {
      data: new Uint8ClampedArray(raw.data),
      width: raw.width,
      height: raw.height,
    };
  }
  throw new Error('Unsupported image format from model (expected PNG or JPEG)');
}

/** Decode raw PNG bytes to an RGBA buffer (first frame only). */
export function decodePng(bytes: Uint8Array): RgbaImage {
  // upng-js wants an ArrayBuffer; slice to a tight one in case `bytes` is a view.
  const ab = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.slice().buffer;
  const img = UPNG.decode(ab as ArrayBuffer);
  const frames = UPNG.toRGBA8(img);
  return {
    data: new Uint8ClampedArray(frames[0] ?? new ArrayBuffer(0)),
    width: img.width,
    height: img.height,
  };
}

/** Encode an RGBA buffer to lossless PNG bytes (cnum=0 = full colour, no quantization). */
export function encodePng(image: RgbaImage): Uint8Array {
  const ab = UPNG.encode(
    [image.data.buffer as ArrayBuffer],
    image.width,
    image.height,
    0
  );
  return new Uint8Array(ab);
}

/**
 * Snap AI green/magenta variants to the exact chroma target (web app parity).
 * Mutates and returns the same RGBA image.
 */
export function normalizeChromaBackground(
  image: RgbaImage,
  chromaKeyColor: ChromaKeyColorType
): RgbaImage {
  const c = CHROMA_KEY_COLORS[chromaKeyColor];
  normalizeChromaBackgroundInPlace(image.data, chromaKeyColor, { r: c.r, g: c.g, b: c.b });
  return image;
}

/**
 * Normalize background color, then run chroma-key removal (matches web sprite sheet flow).
 */
export function processSheetChromaKey(
  image: RgbaImage,
  chromaKeyColor: ChromaKeyColorType
): RgbaImage {
  normalizeChromaBackground(image, chromaKeyColor);
  return removeChromaKey(image, chromaKeyColor);
}

/**
 * Run chroma-key background removal in place using the shared core.
 * Mutates and returns the same RGBA image (alpha + despill applied).
 */
export function removeChromaKey(
  image: RgbaImage,
  chromaKeyColor: ChromaKeyColorType
): RgbaImage {
  const c = CHROMA_KEY_COLORS[chromaKeyColor];
  processChromaKey(
    image.data,
    image.width,
    image.height,
    { r: c.r, g: c.g, b: c.b },
    CHROMA_KEY_FUZZ,
    () => {}, // no-op progress
    CHROMA_KEY_EDGE_BAND_RADIUS,
    CHROMA_KEY_EDGE_BLEND
  );
  return image;
}

/**
 * Extract one cell using the same geometry as `sliceSpriteSheet` in the web app:
 * padding/shift grid, centered per-cell inset, and edge-clipped source mapping.
 */
function extractCellFrame(
  sheet: RgbaImage,
  sx: number,
  sy: number,
  cropW: number,
  cropH: number,
  frameWidth: number,
  frameHeight: number
): RgbaImage {
  const totalWidth = sheet.width;
  const totalHeight = sheet.height;
  const srcLeft = Math.max(0, sx);
  const srcTop = Math.max(0, sy);
  const srcRight = Math.min(totalWidth, sx + cropW);
  const srcBottom = Math.min(totalHeight, sy + cropH);
  const srcW = srcRight - srcLeft;
  const srcH = srcBottom - srcTop;
  const data = new Uint8ClampedArray(frameWidth * frameHeight * 4);

  if (srcW <= 0 || srcH <= 0) {
    return { data, width: frameWidth, height: frameHeight };
  }

  const dstX = ((srcLeft - sx) / cropW) * frameWidth;
  const dstY = ((srcTop - sy) / cropH) * frameHeight;
  const dstW = (srcW / cropW) * frameWidth;
  const dstH = (srcH / cropH) * frameHeight;

  for (let dy = 0; dy < frameHeight; dy++) {
    for (let dx = 0; dx < frameWidth; dx++) {
      const dstOffset = (dy * frameWidth + dx) * 4;
      if (dx < dstX || dx >= dstX + dstW || dy < dstY || dy >= dstY + dstH) {
        continue;
      }
      const u = (dx - dstX) / dstW;
      const v = (dy - dstY) / dstH;
      const srcX = Math.min(totalWidth - 1, Math.max(0, Math.floor(srcLeft + u * srcW)));
      const srcY = Math.min(totalHeight - 1, Math.max(0, Math.floor(srcTop + v * srcH)));
      const srcOffset = (srcY * totalWidth + srcX) * 4;
      data[dstOffset] = sheet.data[srcOffset]!;
      data[dstOffset + 1] = sheet.data[srcOffset + 1]!;
      data[dstOffset + 2] = sheet.data[srcOffset + 2]!;
      data[dstOffset + 3] = sheet.data[srcOffset + 3]!;
    }
  }

  return { data, width: frameWidth, height: frameHeight };
}

export interface SliceSheetOptions {
  insetRatio?: number;
  padding?: OptimizedSliceResult;
  optimize?: boolean;
  /** Detect uneven row/column seams instead of equal division (default true). */
  detectBoundaries?: boolean;
}

/** Auto-trim outer margins on a chroma-keyed sheet (same core as the web app). */
export function optimizeSliceForImage(
  image: RgbaImage,
  cols: number,
  rows: number
): OptimizedSliceResult {
  const margins = measureContentMargins(image.data, image.width, image.height);
  return computeOptimizedSliceFromMargins(
    image.width,
    image.height,
    cols,
    rows,
    margins,
    { conservative: true }
  );
}

export type { GridLayoutScore } from '../../../../utils/sheetGridValidation.ts';

/** Score how well a cols×rows grid aligns with background seams on a processed sheet. */
export function scoreGridLayout(image: RgbaImage, cols: number, rows: number): number {
  return scoreGridLayoutFromRgba(image.data, image.width, image.height, cols, rows);
}

/** Pick the best-scoring grid among candidates (used to detect model layout drift). */
export function detectBestGridLayout(
  image: RgbaImage,
  colCandidates: number[],
  rowCandidates: number[]
): GridLayoutScore {
  return detectBestGridLayoutFromRgba(
    image.data,
    image.width,
    image.height,
    colCandidates,
    rowCandidates
  );
}

/**
 * Slice a sprite sheet into `cols * rows` cells at native resolution.
 * Matches the web app's `sliceSpriteSheet`: auto margin trim, centered per-cell
 * inset, and edge-connected residue cleanup. No resampling.
 */
export function sliceSheet(
  sheet: RgbaImage,
  cols: number,
  rows: number,
  options: SliceSheetOptions = {}
): RgbaImage[] {
  const insetRatio = options.insetRatio ?? LINE_STICKER_CELL_INSET_RATIO;
  const detectBoundaries = options.detectBoundaries !== false;
  const totalWidth = sheet.width;
  const totalHeight = sheet.height;

  let xBounds: number[];
  let yBounds: number[];

  if (detectBoundaries) {
    const detected = detectSheetGridBoundaries(sheet.data, totalWidth, totalHeight, cols, rows);
    xBounds = detected.xBounds;
    yBounds = detected.yBounds;
  } else {
    const padding =
      options.padding ??
      (options.optimize === false
        ? { paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, shiftX: 0, shiftY: 0 }
        : optimizeSliceForImage(sheet, cols, rows));

    const left = padding.paddingLeft;
    const right = padding.paddingRight;
    const top = padding.paddingTop;
    const bottom = padding.paddingBottom;
    let startX = Math.round(left + padding.shiftX);
    let startY = Math.round(top + padding.shiftY);
    startX = Math.max(0, Math.min(startX, totalWidth - 1));
    startY = Math.max(0, Math.min(startY, totalHeight - 1));
    const effectiveWidth = totalWidth - left - right;
    const effectiveHeight = totalHeight - top - bottom;
    if (effectiveWidth <= 0 || effectiveHeight <= 0) {
      throw new Error(`Invalid effective slice area: ${effectiveWidth}x${effectiveHeight}`);
    }

    xBounds = Array.from({ length: cols + 1 }, (_, c) =>
      c === 0 ? startX : c === cols ? startX + effectiveWidth : startX + (c * effectiveWidth) / cols
    );
    yBounds = Array.from({ length: rows + 1 }, (_, r) =>
      r === 0 ? startY : r === rows ? startY + effectiveHeight : startY + (r * effectiveHeight) / rows
    );
  }

  const insetFactor = 1 - 2 * Math.max(0, Math.min(0.2, insetRatio));
  const frames: RgbaImage[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = xBounds[c]!;
      const x1 = xBounds[c + 1]!;
      const y0 = yBounds[r]!;
      const y1 = yBounds[r + 1]!;
      const cellWidth = x1 - x0;
      const cellHeight = y1 - y0;
      const frameWidth = Math.max(1, Math.round(cellWidth));
      const frameHeight = Math.max(1, Math.round(cellHeight));

      const cropW = cellWidth * insetFactor;
      const cropH = cellHeight * insetFactor;
      const sx = x0 + (cellWidth - cropW) / 2;
      const sy = y0 + (cellHeight - cropH) / 2;
      const frame = extractCellFrame(sheet, sx, sy, cropW, cropH, frameWidth, frameHeight);

      if (insetRatio > 0) {
        const maxDepthPx = Math.max(1, Math.round(Math.min(frameWidth, frameHeight) * 0.01));
        clearEdgeConnectedResidue(frame.data, frameWidth, frameHeight, { maxDepthPx });
      }

      frames.push(frame);
    }
  }
  return frames;
}

function sampleBilinear(src: RgbaImage, x: number, y: number): [number, number, number, number] {
  const clampedX = Math.min(Math.max(x, 0), src.width - 1);
  const clampedY = Math.min(Math.max(y, 0), src.height - 1);
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(x0 + 1, src.width - 1);
  const y1 = Math.min(y0 + 1, src.height - 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const idx = (px: number, py: number) => (py * src.width + px) * 4;
  const sample = (px: number, py: number) => {
    const offset = idx(px, py);
    return [
      src.data[offset]!,
      src.data[offset + 1]!,
      src.data[offset + 2]!,
      src.data[offset + 3]!,
    ] as const;
  };

  const c00 = sample(x0, y0);
  const c10 = sample(x1, y0);
  const c01 = sample(x0, y1);
  const c11 = sample(x1, y1);
  const channel = (index: number) =>
    Math.round(
      c00[index]! * (1 - tx) * (1 - ty) +
        c10[index]! * tx * (1 - ty) +
        c01[index]! * (1 - tx) * ty +
        c11[index]! * tx * ty
    );

  return [channel(0), channel(1), channel(2), channel(3)];
}

/** Resize RGBA image with bilinear sampling (used for LINE upload sizing only). */
export function resampleRgba(src: RgbaImage, dstW: number, dstH: number): RgbaImage {
  const width = toEvenDimension(dstW);
  const height = toEvenDimension(dstH);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcY = ((y + 0.5) / height) * src.height - 0.5;
    for (let x = 0; x < width; x += 1) {
      const srcX = ((x + 0.5) / width) * src.width - 0.5;
      const [r, g, b, a] = sampleBilinear(src, srcX, srcY);
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return { data, width, height };
}

function blitOntoCanvas(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  image: RgbaImage,
  offsetX: number,
  offsetY: number
): void {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const srcOffset = (y * image.width + x) * 4;
      const alpha = image.data[srcOffset + 3]! / 255;
      if (alpha <= 0) {
        continue;
      }
      const dstX = offsetX + x;
      const dstY = offsetY + y;
      if (dstX < 0 || dstY < 0 || dstX >= canvasWidth || dstY >= canvasHeight) {
        continue;
      }
      const dstOffset = (dstY * canvasWidth + dstX) * 4;
      const invAlpha = 1 - alpha;
      canvas[dstOffset] = Math.round(image.data[srcOffset]! * alpha + canvas[dstOffset]! * invAlpha);
      canvas[dstOffset + 1] = Math.round(
        image.data[srcOffset + 1]! * alpha + canvas[dstOffset + 1]! * invAlpha
      );
      canvas[dstOffset + 2] = Math.round(
        image.data[srcOffset + 2]! * alpha + canvas[dstOffset + 2]! * invAlpha
      );
      canvas[dstOffset + 3] = Math.round(255 * alpha + canvas[dstOffset + 3]! * invAlpha);
    }
  }
}

function resizeToFitWithin(src: RgbaImage, maxWidth: number, maxHeight: number): RgbaImage {
  const target = computeFitDimensions(src.width, src.height, maxWidth, maxHeight);
  if (target.width === src.width && target.height === src.height) {
    return src;
  }
  return resampleRgba(src, target.width, target.height);
}

function composeCenteredOnCanvas(
  src: RgbaImage,
  canvasWidth: number,
  canvasHeight: number
): RgbaImage {
  const fitted = resizeToFitWithin(src, canvasWidth, canvasHeight);
  const data = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  const offsetX = Math.floor((canvasWidth - fitted.width) / 2);
  const offsetY = Math.floor((canvasHeight - fitted.height) / 2);
  blitOntoCanvas(data, canvasWidth, canvasHeight, fitted, offsetX, offsetY);
  return { data, width: canvasWidth, height: canvasHeight };
}

/** Fit one sticker frame to LINE Creators Market sticker image limits. */
export function prepareLineStickerFrame(frame: RgbaImage): RgbaImage {
  return resizeToFitWithin(
    frame,
    LINE_STICKER_UPLOAD.stickerMaxWidth,
    LINE_STICKER_UPLOAD.stickerMaxHeight
  );
}

/** Build LINE main image (240×240). */
export function prepareLineMainImage(frame: RgbaImage): RgbaImage {
  return composeCenteredOnCanvas(frame, LINE_STICKER_UPLOAD.mainSize, LINE_STICKER_UPLOAD.mainSize);
}

/** Build LINE chat tab image (96×74). */
export function prepareLineTabImage(frame: RgbaImage): RgbaImage {
  return composeCenteredOnCanvas(
    frame,
    LINE_STICKER_UPLOAD.tabWidth,
    LINE_STICKER_UPLOAD.tabHeight
  );
}
