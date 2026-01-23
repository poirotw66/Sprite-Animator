export interface AnimationConfig {
  prompt: string;
  frameCount: number; // Number of images to generate
  speed: number;      // Playback FPS (1-24)
  scale: number;      // Display scale
}

export interface GenerationResult {
  frames: string[]; // Array of base64 image strings
  loading: boolean;
  error: string | null;
}
