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
  hfTokenLabel: string;
  hfTokenPlaceholder: string;
  hfTokenHint: string;
  hfTokenHint2: string;
  getHfToken: string;
  acceptTermsLabel: string;
  modelPageLink: string;

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
  errorSaveProject: string;

  // Status Messages
  statusIdle: string;
  statusPreparing: string;
  statusGenerating: string;
  statusProcessing: string;
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

  // Project History
  projectHistory: string;
  saveProject: string;
  saveProjectAs: string;
  projectNamePlaceholder: string;
  loadProject: string;
  deleteProject: string;
  noProjectsYet: string;
  projectSaved: string;
  projectLoaded: string;
  projectDeleted: string;

  // Language
  language: string;
  languageZhTW: string;
  languageEn: string;

  // Home Page
  homeTitle: string;
  homeSubtitle: string;
  spriteAnimatorTool: string;
  spriteAnimatorDesc: string;
  lineStickerTool: string;
  lineStickerDesc: string;
  enterTool: string;
  backToHome: string;

  // LINE Sticker Tool
  lineStickerTitle: string;
  lineStickerUploadTitle: string;
  lineStickerUploadHint: string;
  lineStickerPromptLabel: string;
  lineStickerPromptPlaceholder: string;
  lineStickerGridSettings: string;
  lineStickerGenerate: string;
  lineStickerGenerating: string;
  lineStickerResult: string;
  lineStickerDownloadSingle: string;
  lineStickerDownloadAll: string;
  lineStickerDownloadZip: string;
  lineStickerDownloadJpg: string;
  lineStickerDownloadPng: string;
  lineStickerFormatLabel: string;
  lineStickerSelectAll: string;
  lineStickerDeselectAll: string;
  lineStickerSelected: string;
  lineStickerDescLabel: string;
  lineStickerDescPlaceholder: string;
  lineStickerCharacterVibe: string;
  lineStickerPersonalityLabel: string;
  lineStickerDescHint: string;
  lineStickerSpriteSheet: string;
  lineStickerShowOriginal: string;
  lineStickerShowProcessed: string;
  lineStickerDownloadOriginal: string;
  lineStickerDownloadProcessed: string;

  // LINE Sticker Tool - Mode
  lineStickerMode: string;
  lineStickerModeSingle: string;
  lineStickerModeSet: string;
  lineStickerModeSetHint: string;
  lineStickerModeSingleHint: string;

  // LINE Sticker Tool - Style / Theme / Phrases
  lineStickerStyleLabel: string;
  lineStickerStyleHint: string;
  lineStickerThemeLabel: string;
  lineStickerThemeTrpg: string;
  lineStickerThemeDaily: string;
  lineStickerThemeSocial: string;
  lineStickerThemeWorkplace: string;
  lineStickerThemeCustom: string;
  lineStickerCustomThemePlaceholder: string;
  lineStickerCustomThemeHint: string;
  lineStickerThemeHint: string;
  lineStickerPhraseListSet: string;
  lineStickerPhraseListSingle: string;
  lineStickerPhraseStyle: string;
  lineStickerPhraseBalanced: string;
  lineStickerPhraseEmotional: string;
  lineStickerPhraseMeme: string;
  lineStickerPhraseInteraction: string;
  lineStickerPhraseThemeDeep: string;
  lineStickerGeneratePhrases: string;
  lineStickerGeneratePhrases48: string;
  lineStickerGeneratingPhrases: string;
  lineStickerPhraseGenHint: string;
  lineStickerPhraseGenHint48: string;
  lineStickerPhraseActionHint: string;
  lineStickerPhraseSetPlaceholder: string;

  // LINE Sticker Tool - Language / Color / Font
  lineStickerTextLangLabel: string;
  lineStickerTextLangHint: string;
  lineStickerLangZhTW: string;
  lineStickerLangZhCN: string;
  lineStickerLangEn: string;
  lineStickerLangJa: string;
  lineStickerTextColorLabel: string;
  lineStickerTextColorHint: string;
  lineStickerFontStyleLabel: string;
  lineStickerFontStyleHint: string;

  // LINE Sticker Tool - Sheet selector / Resolution
  lineStickerSheetSelector: string;
  lineStickerSheetN: string;
  lineStickerSheetInfo: string;
  lineStickerResolutionLabel: string;
  lineStickerResolutionHint: string;

  // LINE Sticker Tool - Generate / Download buttons
  lineStickerGenerateSheetN: string;
  lineStickerGenerateAll: string;
  lineStickerGeneratingAll: string;
  lineStickerDownloadThis: string;
  lineStickerDownload3Zip: string;
  lineStickerDownloadSheetN: string;

  // LINE Sticker Tool - Error / Status
  lineStickerErrorNeedPhrases: string;
  lineStickerErrorPhraseGen: string;
  lineStickerErrorSelectOne: string;
  lineStickerGeneratingSheetN: string;
  lineStickerProcessingSheetN: string;
  lineStickerParallelGenerating: string;
  lineStickerPhrasePlaceholder: string;
  lineStickerTotalFramesSet: string;
  lineStickerDownloadCurrentSheet: string;
  lineStickerDownloadSelected: string;
  lineStickerPreviewCropped: string;
  lineStickerPreviewCropHint: string;
  lineStickerIncludeText: string;
  lineStickerGeneratePrompt: string;
  lineStickerPromptPreviewTitle: string;
  lineStickerPromptConfirmHint: string;
  lineStickerPromptEmptyHint: string;
  lineStickerActionDescPlaceholder: string;

  // RM BG Tool
  rmbgTitle: string;
  rmbgDesc: string;
  rmbgUploadTitle: string;
  rmbgUploadHint: string;
  rmbgProcessButton: string;
  rmbgProcessing: string;
  rmbgDownloadOriginal: string;
  rmbgDownloadProcessed: string;
  rmbgChromaKeyLabel: string;
  rmbgToleranceLabel: string;
  rmbgEdgeBandLabel: string;
  rmbgEdgeBlendLabel: string;
  bgRemovalMethodLabel: string;
  bgRemovalChroma: string;
  bgRemovalAI: string;
}
