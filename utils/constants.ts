// Application constants

export const DEFAULT_CONFIG = {
  frameCount: 4,
  speed: 4, // Default FPS = speed * ANIMATION_FPS_MULTIPLIER (4 * 3 = 12 FPS)
  scale: 100,
  mode: 'sheet' as const,
  gridCols: 3,
  gridRows: 2,
  chromaKeyColor: 'magenta' as const, // Default to magenta, can be 'green' for green screen
  enableInterpolation: false, // Disabled by default to avoid ghosting artifacts
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
// Standard chroma key colors:
// - Magenta: Pure magenta #FF00FF (R=255, G=0, B=255)
// - Green: Standard green screen #00B140 (R=0, G=177, B=64) - industry standard
export const CHROMA_KEY_COLORS = {
  magenta: { r: 255, g: 0, b: 255, hex: '#FF00FF', name: '洋紅色 (Magenta)' },
  green: { r: 0, g: 177, b: 64, hex: '#00B140', name: '綠幕 (Green Screen)' },
} as const;

// Legacy - kept for compatibility
export const CHROMA_KEY_COLOR = CHROMA_KEY_COLORS.magenta;
export const CHROMA_KEY_FUZZ = 35; // 35% tolerance (0-100) - increased for better coverage

export const ANIMATION_FPS_MULTIPLIER = 3; // Increased for smoother playback

// Frame interpolation settings for smooth GIF export
export const DEFAULT_INTERPOLATION_FRAMES = 2; // Number of frames to insert between keyframes
export const GIF_TARGET_FPS = 24; // Target FPS for smooth GIF output
export const ENABLE_FRAME_INTERPOLATION = true; // Enable frame blending for smoother animations

export const GRID_PATTERN_URL = 'https://bg-patterns.com/wp-content/uploads/2021/04/check-pattern-d01.png';

// Example prompts and configurations
export const EXAMPLE_DATA = [
  {
    id: 'cute-smile',
    name: '可愛微笑',
    description: '表情平淡逐漸轉成咪咪眼偷笑',
    prompt: '表情從平淡逐漸轉變成咪咪眼偷笑。動作要非常流暢自然，每幀之間只有微小的變化。請生成 6 幀動畫，背景是純淨的洋紅色 #FF00FF，不要有任何框線或地面線。確保角色位置穩定，只有表情變化。',
    chromaKeyColor: 'magenta' as const,
    gridCols: 3,
    gridRows: 2,
  },
  {
    id: 'character-walk',
    name: '角色行走',
    description: '角色從左到右行走動畫',
    prompt: '從左邊走到右邊。動作要非常流暢，包含抬腿、擺臂等自然的行走動作，每幀之間只有微小的變化。請生成 8 幀動畫，背景是純淨的洋紅色 #FF00FF，不要有任何框線或地面線。',
    chromaKeyColor: 'magenta' as const,
    gridCols: 4,
    gridRows: 2,
  },
  {
    id: 'jump-action',
    name: '跳躍動作',
    description: '角色原地跳躍',
    prompt: '一個可愛的角色原地跳躍。包含蹲下準備、起跳、空中、落地等完整動作，每幀之間變化流暢。請生成 6 幀動畫，背景是純淨的洋紅色 #FF00FF，不要有任何框線或地面線。確保角色水平位置穩定。',
    chromaKeyColor: 'magenta' as const,
    gridCols: 3,
    gridRows: 2,
  },
  {
    id: 'wave-hand',
    name: '揮手動作',
    description: '角色站立揮手',
    prompt: '站立並揮手打招呼。手臂從下方自然抬起並左右擺動，表情友善。動作要流暢，每幀之間只有微小的變化。請生成 6 幀動畫，背景是純淨的洋紅色 #FF00FF，不要有任何框線或地面線。',
    chromaKeyColor: 'magenta' as const,
    gridCols: 3,
    gridRows: 2,
  },
  {
    id: 'idle-breath',
    name: '待機呼吸',
    description: '角色待機時的呼吸動作',
    prompt: '站立，展現自然的呼吸動作。身體微微上下起伏，表情平靜。動作要非常細微流暢。請生成 6 幀動畫，背景是純淨的洋紅色 #FF00FF，不要有任何框線或地面線。',
    chromaKeyColor: 'magenta' as const,
    gridCols: 3,
    gridRows: 2,
  },
] as const;
