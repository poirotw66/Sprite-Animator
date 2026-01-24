export interface AnimationConfig {
  prompt: string;
  frameCount: number; // Used for 'frame' mode
  speed: number;      // Playback FPS (1-24)
  scale: number;      // Display scale
  mode: 'frame' | 'sheet'; // New: Generation mode
  gridCols: number;   // New: Used for 'sheet' mode (default 3)
  gridRows: number;   // New: Used for 'sheet' mode (default 2)
}

export interface GenerationResult {
  frames: string[]; // Array of base64 image strings
  loading: boolean;
  error: string | null;
}