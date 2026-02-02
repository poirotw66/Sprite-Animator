// i18n Type Definitions

export type Language = 'zh-TW' | 'en';

export interface Translations {
  // App Header
  appTitle: string;
  settings: string;
  reset: string;
  customKey: string;
  useCustomKey: string;
  useSystemKey: string;

  // Image Upload
  uploadTitle: string;
  uploadHint: string;
  uploadFormats: string;

  // Animation Config
  configTitle: string;
  frameByFrameMode: string;
  spriteSheetMode: string;
  promptLabel: string;
  promptPlaceholder: string;
  frameCount: string;
  gridCols: string;
  gridRows: string;
  playbackSpeed: string;
  previewScale: string;
  apiRequests: string;

  // Chroma Key
  backgroundColor: string;
  magentaColor: string;
  greenScreen: string;
  magentaHint: string;
  greenHint: string;

  // Background Removal
  removeBackground: string;

  // Frame Interpolation
  gifSmoothing: string;
  smoothingWarning: string;
  smoothingHint: string;

  // Sprite Sheet Mode Hint
  spriteSheetHint: string;

  // Generate Button
  generateSpriteSheet: string;
  startFrameGeneration: string;
  generating: string;

  // Animation Preview
  previewTitle: string;
  frame: string;
  previewArea: string;
  previewHint: string;
  clickToPlayPause: string;
  drawing: string;

  // Export Buttons
  downloadApng: string;
  downloadGif: string;
  downloadZip: string;
  exportHint: string;
  exportSmoothHint: string;

  // Sprite Sheet Viewer
  spriteSheetTitle: string;
  spriteSheetOriginal: string;
  spriteSheetProcessed: string;
  sliceSettings: string;
  gridSliceSettings: string;
  padding: string;
  paddingX: string;
  paddingY: string;
  shift: string;
  shiftX: string;
  shiftY: string;
  resetSettings: string;
  resetScaleAndShift: string;
  autoCenter: string;
  cellSize: string;
  totalFrames: string;
  effectiveArea: string;
  gridSize: string;
  cols: string;
  rows: string;
  horizontalAxis: string;
  verticalAxis: string;
  scalePadding: string;
  removeEdge: string;
  shiftPosition: string;
  fineTunePosition: string;
  autoOptimized: string;
  center: string;
  inferGridFromGaps: string;
  inferGridFromGapsProgress: string;
  dragHint: string;
  downloadProcessed: string;
  downloadOriginal: string;
  processing: string;
  processingChromaKey: string;
  showOriginal: string;
  showProcessed: string;
  spriteSheetPlaceholder: string;

  // Frame Grid
  frameGridTitle: string;
  editFrame: string;
  resetFrame: string;
  closeEditor: string;
  offset: string;
  scale: string;
  usePrevAsRef: string;
  refOpacity: string;
  autoAlign: string;
  smartAlign: string;
  reAlignToAnchor: string;
  reAlignToAnchorProgress: string;
  alignMode: string;
  coreMode: string;
  boundsMode: string;
  massMode: string;
  temporalSmoothing: string;
  aligning: string;
  includeFrame: string;
  excludeFrame: string;

  // Settings Modal
  settingsTitle: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  envKeyDetected: string;
  usingCustomKey: string;
  usingSystemKey: string;
  apiKeyHint: string;
  getApiKey: string;
  modelLabel: string;
  modelRecommended: string;
  saveAndApply: string;
  validating: string;
  validationSuccess: string;
  validationFailed: string;
  apiKeyInvalid: string;
  quotaExceeded: string;
  networkError: string;
  pleaseEnterApiKey: string;

  // Example Selector
  exampleTitle: string;
  exampleHint: string;
  exampleTip: string;
  frames: string;
  magentaBg: string;
  greenBg: string;

  // Error Messages
  errorApiKey: string;
  errorNoImage: string;
  errorNoPrompt: string;
  errorGeneration: string;
  errorRateLimit: string;
  errorExportApng: string;
  errorExportGif: string;
  errorExportZip: string;

  // Status Messages
  statusPreparing: string;
  statusGenerating: string;
  statusOptimizing: string;
  statusOptimized: string;
  statusUsingModel: string;

  // Example Data
  examples: {
    cuteSmile: { name: string; description: string };
    characterWalk: { name: string; description: string };
    jumpAction: { name: string; description: string };
    waveHand: { name: string; description: string };
    idleBreath: { name: string; description: string };
    attack: { name: string; description: string };
  };

  // Language
  language: string;
  languageZhTW: string;
  languageEn: string;
}
