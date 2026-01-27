// Application constants

export const DEFAULT_CONFIG = {
  frameCount: 4,
  speed: 2, // Default FPS = speed * ANIMATION_FPS_MULTIPLIER (2 * 2 = 4 FPS)
  scale: 100,
  mode: 'sheet' as const,
  gridCols: 3,
  gridRows: 2,
};

export const DEFAULT_SLICE_SETTINGS = {
  cols: 3,
  rows: 2,
  paddingX: 0,
  paddingY: 0,
  shiftX: 0,
  shiftY: 0,
};

export const SUPPORTED_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
] as const;

export const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export const BACKGROUND_REMOVAL_THRESHOLD = 230; // For white background removal

export const DEBOUNCE_DELAY = 50; // ms for re-slicing

// Chroma key (magenta) removal settings
export const CHROMA_KEY_COLOR = { r: 255, g: 0, b: 255 }; // #FF00FF
export const CHROMA_KEY_FUZZ = 10; // 10% tolerance (0-100) - increased for better edge handling

export const ANIMATION_FPS_MULTIPLIER = 2;

export const GRID_PATTERN_URL = 'https://bg-patterns.com/wp-content/uploads/2021/04/check-pattern-d01.png';
