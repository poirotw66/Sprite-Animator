// Application constants

export const DEFAULT_CONFIG = {
  frameCount: 4,
  speed: 4, // Default FPS = speed * ANIMATION_FPS_MULTIPLIER (4 * 3 = 12 FPS)
  scale: 100,
  mode: 'sheet' as const,
  gridCols: 3,
  gridRows: 2,
  chromaKeyColor: 'magenta' as const, // Default to magenta, can be 'green' for green screen
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

// Chroma key color options
export const CHROMA_KEY_COLORS = {
  magenta: { r: 255, g: 0, b: 255, hex: '#FF00FF', name: '洋紅色 (Magenta)' },
  green: { r: 0, g: 255, b: 0, hex: '#00FF00', name: '綠幕 (Green Screen)' },
} as const;

// Legacy - kept for compatibility
export const CHROMA_KEY_COLOR = CHROMA_KEY_COLORS.magenta;
export const CHROMA_KEY_FUZZ = 25; // 25% tolerance (0-100)

export const ANIMATION_FPS_MULTIPLIER = 3; // Increased for smoother playback

// Frame interpolation settings for smooth GIF export
export const DEFAULT_INTERPOLATION_FRAMES = 2; // Number of frames to insert between keyframes
export const GIF_TARGET_FPS = 24; // Target FPS for smooth GIF output
export const ENABLE_FRAME_INTERPOLATION = true; // Enable frame blending for smoother animations

export const GRID_PATTERN_URL = 'https://bg-patterns.com/wp-content/uploads/2021/04/check-pattern-d01.png';
