export type ChromaKeyColorType = 'magenta' | 'green';
export type BgRemovalMethod = 'chroma' | 'ai';

export interface AnimationConfig {
  prompt: string;
  frameCount: number; // Used for 'frame' mode
  speed: number;      // Playback FPS (1-24)
  scale: number;      // Display scale
  mode: 'frame' | 'sheet'; // New: Generation mode
  gridCols: number;   // New: Used for 'sheet' mode (default 3)
  gridRows: number;   // New: Used for 'sheet' mode (default 2)
  chromaKeyColor: ChromaKeyColorType; // Background color for chroma key removal
  bgRemovalMethod?: BgRemovalMethod; // Selection for background removal method
  enableInterpolation: boolean; // Enable frame interpolation for smoother GIF export
}

export interface GenerationResult {
  frames: string[]; // Array of base64 image strings
  loading: boolean;
  error: string | null;
}

export interface ExampleData {
  id: string;
  name: string;
  description: string;
  prompt: string;
  chromaKeyColor: ChromaKeyColorType;
  gridCols: number;
  gridRows: number;
}

/** Per-frame override for crop (offsetX, offsetY, scale). Used in saved project. */
export interface SavedFrameOverride {
  offsetX?: number;
  offsetY?: number;
  scale?: number;
}

/** Slice settings snapshot for saved project (matches SliceSettings from imageUtils). */
export interface SavedSliceSettings {
  cols: number;
  rows: number;
  paddingX: number;
  paddingY: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  shiftX: number;
  shiftY: number;
  sliceMode?: 'equal' | 'inferred';
  inferredCellRects?: Array<{ x: number; y: number; width: number; height: number }>;
}

/** Full project snapshot for history (localStorage). */
export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  config: AnimationConfig;
  sliceSettings: SavedSliceSettings;
  removeBackground: boolean;
  sourceImage: string | null;
  spriteSheetImage: string | null;
  frameModeFrames: string[];
  frameOverrides: SavedFrameOverride[];
  frameIncluded: boolean[];
}

/** Lightweight project entry for history list (no base64). */
export interface SavedProjectMeta {
  id: string;
  name: string;
  createdAt: number;
}