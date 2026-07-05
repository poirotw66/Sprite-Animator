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
