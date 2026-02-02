import { Translations } from './types';

export const zhTW: Translations = {
  // App Header
  appTitle: '角色幀動畫小工具',
  settings: '設定',
  reset: '重置',
  customKey: 'Custom Key',
  useCustomKey: '使用自訂 Key',
  useSystemKey: '使用系統 Key (設定)',

  // Image Upload
  uploadTitle: '上傳角色圖片',
  uploadHint: '點擊或拖拽圖片',
  uploadFormats: '支援 PNG、JPG、WebP',

  // Animation Config
  configTitle: '幀動畫參數',
  frameByFrameMode: '逐幀模式',
  spriteSheetMode: '精靈圖模式',
  promptLabel: '動作提示詞',
  promptPlaceholder: '描述連續動作，例如：跑步循環 (Run Cycle)、跳躍 (Jump)、揮劍攻擊 (Sword Attack)...',
  frameCount: '幀數 (Frame Count)',
  gridCols: '網格列 (Cols)',
  gridRows: '網格行 (Rows)',
  playbackSpeed: '播放速度 (FPS)',
  previewScale: '預覽縮放',
  apiRequests: 'API 請求次數',

  // Chroma Key
  backgroundColor: '🎨 背景顏色 (去背用)',
  magentaColor: '洋紅色',
  greenScreen: '綠幕',
  magentaHint: '💡 預設選項。若角色有粉色/紅色部分，請改用綠幕。',
  greenHint: '💡 適合粉色/紅色角色。若角色有綠色部分，請改用洋紅色。',

  // Background Removal
  removeBackground: '去除白色背景',

  // Frame Interpolation
  gifSmoothing: 'GIF 補幀平滑',
  smoothingWarning: '⚠️ 可能產生殘影',
  smoothingHint: '💡 關閉以避免殘影',

  // Sprite Sheet Mode Hint
  spriteSheetHint: '精靈圖模式僅需消耗 1 次 API 請求，大幅節省配額！',

  // Generate Button
  generateSpriteSheet: '生成精靈圖 (1 Request)',
  startFrameGeneration: '開始逐幀生成',
  generating: '生成中...',

  // Animation Preview
  previewTitle: '動畫預覽',
  frame: 'Frame',
  previewArea: '動畫預覽區域',
  previewHint: '將生成多張靜態圖並串接播放',
  clickToPlayPause: '點擊暫停/播放',
  drawing: '正在繪製...',

  // Export Buttons
  downloadApng: '下載 APNG (高清)',
  downloadGif: 'GIF',
  downloadZip: 'ZIP',
  exportHint: '提示：點擊上方預覽區可暫停/播放。APNG 支援全彩半透明。',
  exportSmoothHint: '✨ GIF/APNG 導出自動補幀，生成絲滑動畫 (24 FPS)',

  // Sprite Sheet Viewer
  spriteSheetTitle: '精靈圖',
  spriteSheetOriginal: '原圖預覽',
  spriteSheetProcessed: '已去背預覽',
  sliceSettings: '切分設定',
  gridSliceSettings: '網格切分設定',
  padding: '邊距',
  paddingX: 'X軸邊距',
  paddingY: 'Y軸邊距',
  shift: '位移 (Shift)',
  shiftX: 'X軸位移',
  shiftY: 'Y軸位移',
  resetSettings: '重置',
  resetScaleAndShift: '重置縮放和位移',
  autoCenter: '自動置中',
  cellSize: '格子大小',
  totalFrames: '總幀數',
  effectiveArea: '有效區域',
  gridSize: '網格大小',
  cols: '列',
  rows: '行',
  horizontalAxis: '水平軸調整',
  verticalAxis: '垂直軸調整',
  scalePadding: '縮放',
  removeEdge: '去除邊緣',
  shiftPosition: '位移',
  fineTunePosition: '微調位置',
  autoOptimized: '自動優化',
  center: '居中',
  inferGridFromGaps: '由空隙推斷格線',
  inferGridFromGapsProgress: '推斷中…',
  dragHint: '拖動邊框調整大小 · 拖動網格內移動位置',
  downloadProcessed: '下載精靈圖（已去背）',
  downloadOriginal: '下載原圖',
  processing: '處理中',
  processingChromaKey: '正在處理去背...',
  showOriginal: '顯示原圖',
  showProcessed: '顯示去背',
  spriteSheetPlaceholder: '生成的網格原圖將顯示於此（去背後）',

  // Frame Grid
  frameGridTitle: '幀列表',
  editFrame: '編輯幀',
  resetFrame: '重置',
  closeEditor: '關閉',
  offset: '偏移',
  scale: '縮放',
  usePrevAsRef: '參考前一幀',
  refOpacity: '參考透明度',
  autoAlign: '自動對齊',
  smartAlign: '智能對齊',
  reAlignToAnchor: '重新以錨點對齊',
  reAlignToAnchorProgress: '智能對齊中…',
  alignMode: '對齊模式',
  coreMode: '核心',
  boundsMode: '邊界',
  massMode: '質心',
  temporalSmoothing: '時間平滑',
  aligning: '對齊中...',
  includeFrame: '包含此幀',
  excludeFrame: '排除此幀',

  // Settings Modal
  settingsTitle: '設定',
  apiKeyLabel: 'Gemini API Key',
  apiKeyPlaceholder: 'AIzaSy...',
  envKeyDetected: '已檢測到系統 Key (可覆蓋)',
  usingCustomKey: '使用自訂 Key (優先)',
  usingSystemKey: '使用預設/系統 Key',
  apiKeyHint: '您的 Key 僅會儲存在本地瀏覽器中。',
  getApiKey: '獲取 Key',
  modelLabel: '模型選擇',
  modelRecommended: '(推薦)',
  saveAndApply: '儲存並應用',
  validating: '驗證中...',
  validationSuccess: 'API Key 驗證成功！',
  validationFailed: 'API Key 驗證失敗',
  apiKeyInvalid: 'API Key 無效，請檢查是否正確',
  quotaExceeded: 'API 配額已用完或超過限制',
  networkError: '網路連線錯誤，請檢查網路',
  pleaseEnterApiKey: '請輸入 API Key',

  // Example Selector
  exampleTitle: '範例提示詞',
  exampleHint: '點擊選擇預設的動畫範例',
  exampleTip: '💡 提示：選擇範例後，系統會自動填入提示詞、設定網格大小和背景色。您可以根據需要修改這些設定。',
  frames: '幀',
  magentaBg: '洋紅背景',
  greenBg: '綠幕背景',

  // Error Messages
  errorApiKey: '請先設定 API Key',
  errorNoImage: '請先上傳圖片',
  errorNoPrompt: '請輸入動作提示詞',
  errorGeneration: '生成發生錯誤',
  errorRateLimit: 'API 請求過於頻繁 (429)。系統正在冷卻中，請稍後再試。',
  errorExportApng: 'APNG 導出失敗',
  errorExportGif: 'GIF 導出失敗',
  errorExportZip: 'ZIP 打包失敗',
  errorSaveProject: '儲存專案失敗（儲存空間不足）。請刪除舊專案後再試。',

  // Status Messages
  statusPreparing: '準備生成精靈圖',
  statusGenerating: '準備開始逐幀生成',
  statusOptimizing: '正在自動優化切分參數...',
  statusOptimized: '切分參數已自動優化',
  statusUsingModel: '使用模型',

  // Example Data
  examples: {
    cuteSmile: { name: '可愛微笑', description: '表情平淡逐漸轉成咪咪眼偷笑' },
    characterWalk: { name: '角色行走', description: '角色從左到右行走動畫' },
    jumpAction: { name: '跳躍動作', description: '角色原地跳躍' },
    waveHand: { name: '揮手動作', description: '角色站立揮手' },
    idleBreath: { name: '待機呼吸', description: '角色待機時的呼吸動作' },
    attack: { name: '攻擊動作', description: '角色揮砍攻擊' },
  },

  // Project History
  projectHistory: '歷史項目',
  saveProject: '儲存專案',
  saveProjectAs: '另存為…',
  projectNamePlaceholder: '專案名稱（選填）',
  loadProject: '載入',
  deleteProject: '刪除',
  noProjectsYet: '尚無歷史專案，完成一次生成後可儲存。',
  projectSaved: '已儲存至歷史',
  projectLoaded: '已載入專案',
  projectDeleted: '已刪除',

  // Language
  language: '語言',
  languageZhTW: '繁體中文',
  languageEn: 'English',
};
