/** Shared inputs for engine-friendly sprite exports. */

export interface FrameSize {
  width: number;
  height: number;
}

export interface EngineExportLayout {
  /** Packed atlas width in pixels. */
  sheetWidth: number;
  /** Packed atlas height in pixels. */
  sheetHeight: number;
  /** Logical grid used when packing (strip = N×1). */
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export interface EngineExportTiming {
  /** Playback frames per second. */
  fps: number;
  /** Per-frame duration in milliseconds (Aseprite). */
  durationMs: number;
  loop: boolean;
}

export interface AsepriteFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
