export type ChromaKeyColorType = 'magenta' | 'green';

export interface AnimationConfig {
  prompt: string;
  frameCount: number; // Used for 'frame' mode
  speed: number;      // Playback FPS (1-24)
  scale: number;      // Display scale
  mode: 'frame' | 'sheet'; // New: Generation mode
  gridCols: number;   // New: Used for 'sheet' mode (default 3)
  gridRows: number;   // New: Used for 'sheet' mode (default 2)
  chromaKeyColor: ChromaKeyColorType; // Background color for chroma key removal
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