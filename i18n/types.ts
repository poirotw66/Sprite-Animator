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
  lineStickerUploadSpriteSheet: string;
  lineStickerUploadSpriteSheetHint: string;
  spriteSheetEdit: string;
  spriteSheetEraserTitle: string;
  spriteSheetEraserHint: string;
  spriteSheetEraserBrushSize: string;
  spriteSheetEraserConfirm: string;
  spriteSheetEraserLoading: string;
  spriteSheetEraserLoadError: string;
  spriteSheetEraserExportError: string;
  spriteSheetEraserUndo: string;
  spriteSheetEraserZoomIn: string;
  spriteSheetEraserZoomOut: string;
  spriteSheetEraserRuler: string;
  spriteSheetEraserRulerHint: string;
  spriteSheetReRunChromaKey: string;

  // Frame Grid
  frameGridTitle: string;
  editFrame: string;
  resetFrame: string;
  closeEditor: string;
  cancel: string;
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
  outputResolutionLabel: string;
  outputResolutionHint: string;
  stylePreviewResolutionLabel: string;
  stylePreviewResolutionHint: string;
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
  lineStickerWorkflowBlurb: string;
  lineStickerJumpToResult: string;
  lineStickerSectionStylePreview: string;
  lineStickerSectionThemeBg: string;
  lineStickerSectionStickerText: string;
  lineStickerSectionPhrasesPrompt: string;
  lineStickerFontPreviewCaption: string;
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
  lineStickerStyleMatchUploaded: string;
  lineStickerStyleHint: string;
  lineStickerStylePreviewDownload: string;
  lineStickerStylePreviewUseAsReference: string;
  lineStickerStyleCustom: string;
  lineStickerStyleCustomLabel: string;
  lineStickerStyleCustomPlaceholder: string;
  lineStickerThemeLabel: string;
  lineStickerThemeDaily: string;
  lineStickerThemeSocial: string;
  lineStickerThemeWorkplace: string;
  lineStickerThemeCustom: string;
  lineStickerCustomThemePlaceholder: string;
  lineStickerCustomThemeHint: string;
  lineStickerThemeHint: string;
  lineStickerPhraseListSet: string;
  lineStickerPhraseListSingle: string;
  lineStickerGeneratePhrases: string;
  lineStickerGeneratePhrases48: string;
  lineStickerGeneratingPhrases: string;
  lineStickerPhraseGenHint: string;
  lineStickerPhraseGenHint48: string;
  lineStickerPhraseActionHint: string;
  lineStickerPhraseSetPlaceholder: string;
  lineStickerPhraseSetDownload: string;
  lineStickerPhraseSetUpload: string;
  lineStickerPhraseSetUploadError: string;

  // LINE Sticker Tool - Language / Color / Font
  lineStickerTextLangLabel: string;
  lineStickerTextLangHint: string;
  lineStickerPromptVersionLabel: string;
  lineStickerPromptVersionHint: string;
  lineStickerPromptVersionV1: string;
  lineStickerPromptVersionV2: string;
  lineStickerActionDedupeStrengthLabel: string;
  lineStickerActionDedupeStrengthHint: string;
  lineStickerActionDedupeConservative: string;
  lineStickerActionDedupeBalanced: string;
  lineStickerActionDedupeAggressive: string;
  lineStickerLangZhTW: string;
  lineStickerLangZhCN: string;
  lineStickerLangEn: string;
  lineStickerLangJa: string;
  lineStickerTextColorLabel: string;
  lineStickerTextColorHint: string;
  lineStickerFontStyleLabel: string;
  lineStickerFontStyleHint: string;
  lineStickerFontCustomLabel: string;
  lineStickerFontCustomPlaceholder: string;

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
  lineStickerDownload3SheetsFramesZip: string;
  lineStickerDownloadAllOneClick: string;
  lineStickerDownloadSheetN: string;

  // LINE Sticker Tool - Error / Status
  lineStickerErrorNeedPhrases: string;
  lineStickerErrorPhraseGen: string;
  lineStickerErrorSelectOne: string;
  lineStickerGeneratingSheetN: string;
  lineStickerProcessingSheetN: string;
  lineStickerParallelGenerating: string;
  lineStickerQueuedSheetN: string;
  lineStickerSlicingSheetN: string;
  lineStickerSheetReadyN: string;
  lineStickerSheetFailedN: string;
  lineStickerRetryFailed: string;
  lineStickerRetrySheetN: string;
  lineStickerErrorSomeSheetsFailed: string;
  lineStickerSheetProgressTitle: string;
  lineStickerPhrasePlaceholder: string;
  lineStickerTotalFramesSet: string;
  lineStickerDownloadCurrentSheet: string;
  lineStickerDownloadSelected: string;
  lineStickerPreviewCropped: string;
  lineStickerPreviewCropHint: string;
  /** Single-sheet result column: edit phrases for programmatic overlay after upload. */
  lineStickerResultProgrammaticPhrasesTitle: string;
  lineStickerResultProgrammaticPhrasesHint: string;
  /** Shown inside the floating frame-edit panel when programmatic text is on. */
  lineStickerFrameEditProgrammaticStyleSubtitle: string;
  lineStickerIncludeText: string;
  lineStickerTextRenderingModel: string;
  lineStickerTextRenderingProgrammatic: string;
  lineStickerTextRenderingLabel: string;
  lineStickerTextRenderingHint: string;
  lineStickerProgrammaticTuningTitle: string;
  lineStickerProgrammaticTuningHint: string;
  lineStickerProgrammaticTextColorLabel: string;
  lineStickerProgrammaticFontSourceLabel: string;
  lineStickerProgrammaticFontSourcePreset: string;
  lineStickerProgrammaticFontSourceCustom: string;
  lineStickerProgrammaticFontPresetLabel: string;
  lineStickerProgrammaticFontPresetCanvasNote: string;
  lineStickerProgrammaticFontCustomLabel: string;
  lineStickerProgrammaticFontCustomPlaceholder: string;
  lineStickerProgrammaticFontCustomHint: string;
  lineStickerProgrammaticOffsetX: string;
  lineStickerProgrammaticOffsetY: string;
  lineStickerProgrammaticFontSize: string;
  lineStickerProgrammaticEdgeMargin: string;
  lineStickerProgrammaticLineHeight: string;
  lineStickerProgrammaticStrokeScale: string;
  lineStickerProgrammaticPlacement: string;
  lineStickerProgrammaticPlacementCycle: string;
  lineStickerProgrammaticPlacementBottom: string;
  lineStickerProgrammaticPlacementTop: string;
  lineStickerProgrammaticPlacementMiddle: string;
  lineStickerProgrammaticPlacementAutoAvoidSubject: string;
  lineStickerProgrammaticPlacementAutoAvoidSubjectHint: string;
  lineStickerProgrammaticPerFramePlacementTitle: string;
  lineStickerProgrammaticPerFramePlacementHint: string;
  lineStickerProgrammaticPerFrameInheritGlobal: string;
  lineStickerProgrammaticFontWeight: string;
  lineStickerProgrammaticResetTuning: string;
  lineStickerGeneratePrompt: string;
  lineStickerPromptPreviewTitle: string;
  lineStickerPromptCurrentVersion: string;
  lineStickerCopyPrompt: string;
  lineStickerCopyPromptDone: string;
  lineStickerPromptConfirmHint: string;
  lineStickerPromptEmptyHint: string;
  lineStickerPromptSummaryLabel: string;
  lineStickerPromptSummaryEmpty: string;
  lineStickerSetOverviewTitle: string;
  lineStickerSetOverviewHint: string;
  lineStickerSheetIdle: string;
  lineStickerErrorReasonLabel: string;
  lineStickerActionDescPlaceholder: string;
  lineStickerActionDescBackfilling: string;

  // RM BG Tool
  rmbgTitle: string;
  rmbgDesc: string;
  partingTitle: string;
  partingDesc: string;
  partingOptimizeButton: string;

  /** After slicing: draw text on each cell in the browser (upload / split tools + sprite sheet mode). */
  sheetSliceProgrammaticOverlayTitle: string;
  sheetSliceProgrammaticOverlayEnable: string;
  sheetSliceProgrammaticOverlayHint: string;
  sheetSliceProgrammaticOverlayLabels: string;
  sheetSliceProgrammaticOverlayPlaceholder: string;
  sheetSliceProgrammaticOverlayFontSource: string;
  sheetSliceProgrammaticOverlayFont: string;
  sheetSliceProgrammaticOverlayColor: string;
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
