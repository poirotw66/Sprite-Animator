import UPNG from 'upng-js';
import { layoutFrames } from './layoutFrames';
import type { AsepriteFrameRect, EngineExportLayout } from './types';

function decodePngDataUrl(dataUrl: string): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const base64 = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoded = UPNG.decode(bytes.buffer);
  const rgba = UPNG.toRGBA8(decoded);
  return {
    data: new Uint8ClampedArray(rgba[0]),
    width: decoded.width,
    height: decoded.height,
  };
}

function encodePngDataUrl(rgba: ArrayBuffer, width: number, height: number): string {
  const buffer = UPNG.encode([rgba], width, height, 0);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export interface PackSpriteSheetResult {
  layout: EngineExportLayout;
  rects: AsepriteFrameRect[];
  /** PNG data URL for the packed atlas. */
  sheetDataUrl: string;
  /** Raw PNG bytes (for ZIP without re-encoding). */
  sheetPngBytes: Uint8Array;
}

export interface PackSpriteSheetOptions {
  cols?: number;
  rows?: number;
}

/**
 * Pack equal-sized frame PNGs (data URLs) into a single atlas PNG.
 * Uses a horizontal strip unless cols/rows are provided.
 */
export function packSpriteSheetFromFrameDataUrls(
  frameDataUrls: string[],
  options: PackSpriteSheetOptions = {},
): PackSpriteSheetResult {
  if (frameDataUrls.length < 1) {
    throw new Error('frameDataUrls must not be empty');
  }

  const decoded = frameDataUrls.map(decodePngDataUrl);
  const frameWidth = decoded[0].width;
  const frameHeight = decoded[0].height;
  for (const frame of decoded) {
    if (frame.width !== frameWidth || frame.height !== frameHeight) {
      throw new Error('All frames must share the same dimensions for atlas packing');
    }
  }

  const { layout, rects } = layoutFrames({
    frameWidth,
    frameHeight,
    frameCount: decoded.length,
    cols: options.cols,
    rows: options.rows,
  });

  const sheet = new Uint8ClampedArray(layout.sheetWidth * layout.sheetHeight * 4);
  for (let index = 0; index < decoded.length; index += 1) {
    const rect = rects[index];
    const src = decoded[index].data;
    for (let y = 0; y < frameHeight; y += 1) {
      const srcRow = y * frameWidth * 4;
      const destRow = ((rect.y + y) * layout.sheetWidth + rect.x) * 4;
      sheet.set(src.subarray(srcRow, srcRow + frameWidth * 4), destRow);
    }
  }

  const pngBuffer = UPNG.encode([sheet.buffer], layout.sheetWidth, layout.sheetHeight, 0);
  const sheetPngBytes = new Uint8Array(pngBuffer);
  const sheetDataUrl = encodePngDataUrl(sheet.buffer, layout.sheetWidth, layout.sheetHeight);

  return { layout, rects, sheetDataUrl, sheetPngBytes };
}
