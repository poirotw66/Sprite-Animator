/**
 * Node image glue for the LINE sticker skill.
 *
 * Replaces the browser Canvas layer of the web app with pure-JS PNG handling:
 *   - decode/encode PNG via upng-js (already a project dependency, no native build)
 *   - chroma-key removal via the SHARED `processChromaKey` core (same algorithm
 *     the app's Web Worker + main-thread fallback use — imported, not copied)
 *   - slicing by integer buffer cropping at NATIVE resolution (no resampling)
 *
 * Everything here is headless: no DOM, no canvas, no React.
 */

import UPNG from 'upng-js';
import jpeg from 'jpeg-js';
import { processChromaKey } from '../../../../utils/chromaKeyCore.ts';
import {
  CHROMA_KEY_COLORS,
  CHROMA_KEY_FUZZ,
  CHROMA_KEY_EDGE_BAND_RADIUS,
  CHROMA_KEY_EDGE_BLEND,
  LINE_STICKER_CELL_INSET_RATIO,
} from '../../../../utils/constants.ts';
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

/** Crop a sub-rectangle out of an RGBA image at native resolution (no scaling). */
function cropRect(
  src: RgbaImage,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): RgbaImage {
  const out = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const srcStart = ((sy + y) * src.width + sx) * 4;
    const dstStart = y * sw * 4;
    out.set(src.data.subarray(srcStart, srcStart + sw * 4), dstStart);
  }
  return { data: out, width: sw, height: sh };
}

/**
 * Slice a sprite sheet into `cols * rows` equal cells at native resolution.
 * Applies the same small per-cell safety inset the app uses, so any residual
 * cell-boundary seam the model drew is cropped out. No resampling.
 */
export function sliceSheet(
  sheet: RgbaImage,
  cols: number,
  rows: number,
  insetRatio: number = LINE_STICKER_CELL_INSET_RATIO
): RgbaImage[] {
  const cellW = Math.floor(sheet.width / cols);
  const cellH = Math.floor(sheet.height / rows);
  const insetX = Math.round(cellW * insetRatio);
  const insetY = Math.round(cellH * insetRatio);
  const frames: RgbaImage[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = col * cellW + insetX;
      const sy = row * cellH + insetY;
      const sw = Math.max(1, cellW - insetX * 2);
      const sh = Math.max(1, cellH - insetY * 2);
      frames.push(cropRect(sheet, sx, sy, sw, sh));
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
