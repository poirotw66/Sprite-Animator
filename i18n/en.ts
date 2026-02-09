import { Translations } from './types';

export const en: Translations = {
  // App Header
  appTitle: 'Sprite Animator',
  settings: 'Settings',
  reset: 'Reset',
  customKey: 'Custom Key',
  useCustomKey: 'Using Custom Key',
  useSystemKey: 'Using System Key (Settings)',

  // Image Upload
  uploadTitle: 'Upload Character Image',
  uploadHint: 'Click or drag to upload',
  uploadFormats: 'Supports PNG, JPG, WebP',

  // Animation Config
  configTitle: 'Animation Settings',
  frameByFrameMode: 'Frame Mode',
  spriteSheetMode: 'Sprite Sheet Mode',
  promptLabel: 'Action Prompt',
  promptPlaceholder: 'Describe the animation, e.g.: Run Cycle, Jump, Sword Attack...',
  frameCount: 'Frame Count',
  gridCols: 'Grid Cols',
  gridRows: 'Grid Rows',
  playbackSpeed: 'Playback Speed (FPS)',
  previewScale: 'Preview Scale',
  apiRequests: 'API Requests',

  // Chroma Key
  backgroundColor: '🎨 Background Color (for removal)',
  magentaColor: 'Magenta',
  greenScreen: 'Green Screen',
  magentaHint: '💡 Default option. Use green screen if character has pink/red parts.',
  greenHint: '💡 For pink/red characters. Use magenta if character has green parts.',

  // Background Removal
  removeBackground: 'Remove White Background',

  // Frame Interpolation
  gifSmoothing: 'GIF Frame Smoothing',
  smoothingWarning: '⚠️ May cause ghosting',
  smoothingHint: '💡 Disable to avoid ghosting',

  // Sprite Sheet Mode Hint
  spriteSheetHint: 'Sprite sheet mode uses only 1 API request, saving your quota!',

  // Generate Button
  generateSpriteSheet: 'Generate Sprite Sheet (1 Request)',
  startFrameGeneration: 'Start Frame Generation',
  generating: 'Generating...',

  // Animation Preview
  previewTitle: 'Animation Preview',
  frame: 'Frame',
  previewArea: 'Animation Preview Area',
  previewHint: 'Multiple frames will be generated and played in sequence',
  clickToPlayPause: 'Click to play/pause',
  drawing: 'Drawing...',

  // Export Buttons
  downloadApng: 'Download APNG (HD)',
  downloadGif: 'GIF',
  downloadZip: 'ZIP',
  exportHint: 'Tip: Click preview area to play/pause. APNG supports full-color transparency.',
  exportSmoothHint: '✨ GIF/APNG export with frame interpolation for smooth animation (24 FPS)',

  // Sprite Sheet Viewer
  spriteSheetTitle: 'Sprite Sheet',
  spriteSheetOriginal: 'Original Preview',
  spriteSheetProcessed: 'Processed Preview',
  sliceSettings: 'Slice Settings',
  gridSliceSettings: 'Grid Slice Settings',
  padding: 'Padding',
  paddingX: 'X Padding',
  paddingY: 'Y Padding',
  shift: 'Shift',
  shiftX: 'X Shift',
  shiftY: 'Y Shift',
  resetSettings: 'Reset',
  resetScaleAndShift: 'Reset Scale and Shift',
  autoCenter: 'Auto Center',
  cellSize: 'Cell Size',
  totalFrames: 'Total Frames',
  effectiveArea: 'Effective Area',
  gridSize: 'Grid Size',
  cols: 'Cols',
  rows: 'Rows',
  horizontalAxis: 'Horizontal Axis',
  verticalAxis: 'Vertical Axis',
  scalePadding: 'Scale',
  removeEdge: 'Remove edges',
  shiftPosition: 'Shift',
  fineTunePosition: 'Fine-tune position',
  autoOptimized: 'Auto Optimized',
  center: 'Center',
  dragHint: 'Drag border to resize · Drag inside to move',
  downloadProcessed: 'Download (Processed)',
  downloadOriginal: 'Download (Original)',
  processing: 'Processing',
  processingChromaKey: 'Processing background removal...',
  showOriginal: 'Show Original',
  showProcessed: 'Show Processed',
  spriteSheetPlaceholder: 'Generated sprite sheet will appear here (after processing)',

  // Frame Grid
  frameGridTitle: 'Frame List',
  editFrame: 'Edit Frame',
  resetFrame: 'Reset',
  closeEditor: 'Close',
  offset: 'Offset',
  scale: 'Scale',
  usePrevAsRef: 'Use Previous as Reference',
  refOpacity: 'Reference Opacity',
  autoAlign: 'Auto Align',
  smartAlign: 'Smart Align',
  reAlignToAnchor: 'Re-align to Anchor',
  reAlignToAnchorProgress: 'Aligning…',
  alignMode: 'Align Mode',
  coreMode: 'Core',
  boundsMode: 'Bounds',
  massMode: 'Mass',
  temporalSmoothing: 'Temporal Smoothing',
  aligning: 'Aligning...',
  includeFrame: 'Include Frame',
  excludeFrame: 'Exclude Frame',

  // Settings Modal
  settingsTitle: 'Settings',
  apiKeyLabel: 'Gemini API Key',
  apiKeyPlaceholder: 'AIzaSy...',
  envKeyDetected: 'System Key detected (can override)',
  usingCustomKey: 'Using Custom Key (priority)',
  usingSystemKey: 'Using Default/System Key',
  apiKeyHint: 'Your key is stored locally in browser only.',
  getApiKey: 'Get Key',
  modelLabel: 'Model Selection',
  modelRecommended: '(Recommended)',
  saveAndApply: 'Save & Apply',
  validating: 'Validating...',
  validationSuccess: 'API Key validated successfully!',
  validationFailed: 'API Key validation failed',
  apiKeyInvalid: 'Invalid API Key, please check',
  quotaExceeded: 'API quota exceeded or rate limited',
  networkError: 'Network error, please check connection',
  pleaseEnterApiKey: 'Please enter API Key',

  // Example Selector
  exampleTitle: 'Example Prompts',
  exampleHint: 'Click to select a preset animation example',
  exampleTip: '💡 Tip: After selecting an example, the system will auto-fill the prompt, grid size and background color. You can modify these settings as needed.',
  frames: 'frames',
  magentaBg: 'Magenta BG',
  greenBg: 'Green BG',

  // Error Messages
  errorApiKey: 'Please set API Key first',
  errorNoImage: 'Please upload an image first',
  errorNoPrompt: 'Please enter an action prompt',
  errorGeneration: 'Generation error',
  errorRateLimit: 'API rate limited (429). Cooling down, please try again later.',
  errorExportApng: 'APNG export failed',
  errorExportGif: 'GIF export failed',
  errorExportZip: 'ZIP export failed',
  errorSaveProject: 'Failed to save project (storage full). Try deleting old projects first.',

  // Status Messages
  statusIdle: 'AI is thinking...',
  statusPreparing: 'Preparing sprite sheet',
  statusGenerating: 'Preparing frame-by-frame generation',
  statusOptimizing: 'Auto-optimizing slice parameters...',
  statusOptimized: 'Slice parameters optimized',
  statusUsingModel: 'Using model',

  // Example Data
  examples: {
    cuteSmile: { name: 'Cute Smile', description: 'Expression changes from neutral to shy smile' },
    characterWalk: { name: 'Walk Cycle', description: 'Character walking from left to right' },
    jumpAction: { name: 'Jump Action', description: 'Character jumping in place' },
    waveHand: { name: 'Wave Hand', description: 'Character standing and waving' },
    idleBreath: { name: 'Idle Breathing', description: 'Character idle breathing animation' },
    attack: { name: 'Attack Action', description: 'Character slashing attack' },
  },

  // Project History
  projectHistory: 'Project History',
  saveProject: 'Save Project',
  saveProjectAs: 'Save As…',
  projectNamePlaceholder: 'Project name (optional)',
  loadProject: 'Load',
  deleteProject: 'Delete',
  noProjectsYet: 'No projects yet. Save after generating once.',
  projectSaved: 'Saved to history',
  projectLoaded: 'Project loaded',
  projectDeleted: 'Deleted',

  // Language
  language: 'Language',
  languageZhTW: '繁體中文',
  languageEn: 'English',

  // Home Page
  homeTitle: 'Sprite Toolbox',
  homeSubtitle: 'Select a tool to get started',
  spriteAnimatorTool: 'Sprite Animator',
  spriteAnimatorDesc: 'Upload character image, AI generates sprite sheet and splits into animation frames, supports GIF/APNG export',
  lineStickerTool: 'LINE Sticker Maker',
  lineStickerDesc: 'Upload character image, AI generates various expressions as sprite sheet, auto-split into LINE sticker assets',
  enterTool: 'Enter Tool',
  backToHome: 'Back to Home',

  // LINE Sticker Tool
  lineStickerTitle: 'LINE Sticker Maker',
  lineStickerUploadTitle: 'Upload Character Image',
  lineStickerUploadHint: 'Click or drag to upload',
  lineStickerPromptLabel: 'Sticker Description',
  lineStickerPromptPlaceholder: 'Describe the sticker themes, e.g.: happy, sad, angry, surprised expressions...',
  lineStickerGridSettings: 'Grid Settings',
  lineStickerGenerate: 'Generate Sprite Sheet',
  lineStickerGenerating: 'Generating...',
  lineStickerResult: 'Sticker Assets',
  lineStickerDownloadSingle: 'Download Single',
  lineStickerDownloadAll: 'Download All',
  lineStickerDownloadZip: 'Download as ZIP',
  lineStickerDownloadJpg: 'JPG Format',
  lineStickerDownloadPng: 'PNG Format',
  lineStickerFormatLabel: 'Download Format',
  lineStickerSelectAll: 'Select All',
  lineStickerDeselectAll: 'Deselect All',
  lineStickerSelected: 'Selected',
};
