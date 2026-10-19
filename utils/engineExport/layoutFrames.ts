import type { AsepriteFrameRect, EngineExportLayout } from './types';

export interface LayoutFramesInput {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  /**
   * When set, pack into this grid (left-to-right, top-to-bottom).
   * Otherwise pack a single horizontal strip.
   */
  cols?: number;
  rows?: number;
}

/**
 * Compute atlas size and per-frame rectangles for a regular grid or strip.
 * Frames are placed left-to-right, then top-to-bottom, with no padding.
 */
export function layoutFrames(input: LayoutFramesInput): {
  layout: EngineExportLayout;
  rects: AsepriteFrameRect[];
} {
  const { frameWidth, frameHeight, frameCount } = input;
  if (frameCount < 1) {
    throw new Error('frameCount must be at least 1');
  }
  if (frameWidth < 1 || frameHeight < 1) {
    throw new Error('frame dimensions must be at least 1');
  }

  let cols: number;
  let rows: number;
  if (input.cols != null && input.rows != null && input.cols >= 1 && input.rows >= 1) {
    cols = input.cols;
    rows = input.rows;
    if (cols * rows < frameCount) {
      throw new Error('cols * rows must cover frameCount');
    }
  } else {
    cols = frameCount;
    rows = 1;
  }

  const sheetWidth = cols * frameWidth;
  const sheetHeight = rows * frameHeight;
  const rects: AsepriteFrameRect[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    rects.push({
      x: col * frameWidth,
      y: row * frameHeight,
      w: frameWidth,
      h: frameHeight,
    });
  }

  return {
    layout: {
      sheetWidth,
      sheetHeight,
      cols,
      rows,
      frameWidth,
      frameHeight,
      frameCount,
    },
    rects,
  };
}
