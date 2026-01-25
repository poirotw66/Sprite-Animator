// Application constants

export const DEFAULT_CONFIG = {
  frameCount: 4,
  speed: 8,
  scale: 100,
  mode: 'sheet' as const,
  gridCols: 4,
  gridRows: 4,
};

export const DEFAULT_SLICE_SETTINGS = {
  cols: 4,
  rows: 4,
  paddingX: 0,
  paddingY: 0,
  shiftX: 0,
  shiftY: 0,
};

export const SUPPORTED_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp',
] as const;

export const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export const BACKGROUND_REMOVAL_THRESHOLD = 230;

export const DEBOUNCE_DELAY = 50; // ms for re-slicing

export const ANIMATION_FPS_MULTIPLIER = 2;

export const GRID_PATTERN_URL = 'https://bg-patterns.com/wp-content/uploads/2021/04/check-pattern-d01.png';
