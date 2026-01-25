import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Settings, Zap } from './components/Icons';
import { SettingsModal } from './components/SettingsModal';
import { ImageUpload } from './components/ImageUpload';
import { AnimationConfigPanel } from './components/AnimationConfig';
import { SpriteSheetViewer } from './components/SpriteSheetViewer';
import { AnimationPreview } from './components/AnimationPreview';
import { FrameGrid } from './components/FrameGrid';
import { generateAnimationFrames, generateSpriteSheet } from './services/geminiService';
import { AnimationConfig as AnimationConfigType } from './types';
import { useSettings } from './hooks/useSettings';
import { useAnimation } from './hooks/useAnimation';
import { useSpriteSheet } from './hooks/useSpriteSheet';
import { useExport } from './hooks/useExport';
import { DEFAULT_CONFIG, DEFAULT_SLICE_SETTINGS } from './utils/constants';

const App: React.FC = () => {
  // Settings
  const {
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    showSettings,
    setShowSettings,
    saveSettings,
    getEffectiveApiKey,
  } = useSettings();

  // Image upload
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animation config
  const [config, setConfig] = useState<AnimationConfigType>(DEFAULT_CONFIG);

  // Slice settings (for sprite sheet mode)
  const [sliceSettings, setSliceSettings] = useState(DEFAULT_SLICE_SETTINGS);

  // Background removal
  const [removeBackground, setRemoveBackground] = useState(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('AI 正在思考中...');
  const [error, setError] = useState<string | null>(null);
  const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Sprite sheet hook
  const {
    generatedFrames: spriteSheetFrames,
    setGeneratedFrames: setSpriteSheetFrames,
    sheetDimensions,
    setSheetDimensions,
    handleImageLoad,
  } = useSpriteSheet(spriteSheetImage, sliceSettings, removeBackground, config.mode);

  // Frame-by-frame mode frames
  const [frameModeFrames, setFrameModeFrames] = useState<string[]>([]);

  // Combined frames (from either mode)
  const generatedFrames = useMemo(() => {
    return config.mode === 'sheet' ? spriteSheetFrames : frameModeFrames;
  }, [config.mode, spriteSheetFrames, frameModeFrames]);

  // Animation hook
  const { currentFrameIndex, setCurrentFrameIndex, handleFrameClick: onFrameClick } = useAnimation(
    generatedFrames,
    config,
    isPlaying
  );

  // Export hook
  const {
    isExporting,
    handleDownloadApng,
    handleDownloadGif,
    handleDownloadZip,
    handleDownloadSpriteSheet,
  } = useExport(generatedFrames, config);

  // Sync slice settings with config when config changes
  useEffect(() => {
    setSliceSettings((prev) => ({
      ...prev,
      cols: config.gridCols,
      rows: config.gridRows,
    }));
  }, [config.gridCols, config.gridRows]);

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setSpriteSheetFrames([]);
        setFrameModeFrames([]);
        setSpriteSheetImage(null);
      };
      reader.readAsDataURL(file);
    }
  }, [setSpriteSheetFrames]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setSpriteSheetFrames([]);
        setFrameModeFrames([]);
        setSpriteSheetImage(null);
      };
      reader.readAsDataURL(file);
    }
  }, [setSpriteSheetFrames]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    const effectiveKey = getEffectiveApiKey();

    if (!effectiveKey) {
      setShowSettings(true);
      setError('請先設定 API Key');
      return;
    }

    if (!sourceImage) {
      setError('請先上傳圖片');
      return;
    }
    if (!config.prompt.trim()) {
      setError('請輸入動作提示詞');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSpriteSheetFrames([]);
    setFrameModeFrames([]);
    setSpriteSheetImage(null);
    setIsPlaying(true);

    // Reset Slice Settings to match Config on new generation
    setSliceSettings({
      cols: config.gridCols,
      rows: config.gridRows,
      paddingX: 0,
      paddingY: 0,
      shiftX: 0,
      shiftY: 0,
    });

    // If using user key, we assume higher limits and reduce artificial delay
    const delayBetweenFrames = apiKey.trim() ? 2000 : 5000;

    try {
      if (config.mode === 'sheet') {
        setStatusText(`準備生成精靈圖 (使用模型: ${selectedModel})...`);

        const sheetImage = await generateSpriteSheet(
          sourceImage,
          config.prompt,
          config.gridCols,
          config.gridRows,
          effectiveKey,
          selectedModel,
          (status) => setStatusText(status)
        );

        setSpriteSheetImage(sheetImage);
      } else {
        // Frame by Frame mode
        setStatusText(`準備開始逐幀生成 (使用模型: ${selectedModel})`);
        const frames = await generateAnimationFrames(
          sourceImage,
          config.prompt,
          config.frameCount,
          effectiveKey,
          selectedModel,
          (status) => setStatusText(status),
          delayBetweenFrames
        );
        setFrameModeFrames(frames);
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Unknown error';
      let displayMsg = '生成失敗';

      if (
        rawMsg.includes('429') ||
        rawMsg.includes('Quota') ||
        rawMsg.includes('RESOURCE_EXHAUSTED')
      ) {
        displayMsg = 'API 請求過於頻繁 (429)。系統正在冷卻中，請稍後再試。';
      } else {
        displayMsg = `生成發生錯誤: ${rawMsg}`;
      }

      setError(displayMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [
    getEffectiveApiKey,
    sourceImage,
    config,
    selectedModel,
    apiKey,
    setSpriteSheetFrames,
    setShowSettings,
    setFrameModeFrames,
    setSpriteSheetImage,
    setSliceSettings,
  ]);

  // Handle reset
  const handleReset = useCallback(() => {
    setSourceImage(null);
    setSpriteSheetFrames([]);
    setFrameModeFrames([]);
    setSpriteSheetImage(null);
    setSheetDimensions({ width: 0, height: 0 });
    setError(null);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
    setConfig((prev) => ({ ...prev, prompt: '' }));
    setSliceSettings(DEFAULT_SLICE_SETTINGS);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setSpriteSheetFrames, setCurrentFrameIndex, setSheetDimensions]);

  // Handle frame click (pause when user manually selects a frame)
  const handleFrameClick = useCallback(
    (index: number) => {
      onFrameClick(index);
      setIsPlaying(false);
    },
    [onFrameClick]
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Determine key status for UI
  const hasCustomKey = useMemo(() => !!apiKey.trim(), [apiKey]);

  // Handle export errors
  const handleExportError = useCallback((error: Error) => {
    setError(error.message);
  }, []);

  // Wrapped export functions with error handling
  const wrappedDownloadApng = useCallback(async () => {
    try {
      await handleDownloadApng();
    } catch (err) {
      handleExportError(err instanceof Error ? err : new Error('APNG 導出失敗'));
    }
  }, [handleDownloadApng, handleExportError]);

  const wrappedDownloadGif = useCallback(async () => {
    try {
      await handleDownloadGif();
    } catch (err) {
      handleExportError(err instanceof Error ? err : new Error('GIF 導出失敗'));
    }
  }, [handleDownloadGif, handleExportError]);

  const wrappedDownloadZip = useCallback(async () => {
    try {
      await handleDownloadZip();
    } catch (err) {
      handleExportError(err instanceof Error ? err : new Error('ZIP 打包失敗'));
    }
  }, [handleDownloadZip, handleExportError]);

  const wrappedDownloadSpriteSheet = useCallback(() => {
    if (spriteSheetImage) {
      handleDownloadSpriteSheet(spriteSheetImage);
    }
  }, [spriteSheetImage, handleDownloadSpriteSheet]);

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 md:p-8 font-sans">
      <SettingsModal
        apiKey={apiKey}
        setApiKey={setApiKey}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        showSettings={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
      />

      <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <div className="bg-orange-500 p-1.5 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          角色幀動畫小工具
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 rounded-full transition-all shadow-sm border border-transparent flex items-center gap-2
              ${
                hasCustomKey
                  ? 'text-green-600 bg-green-50 hover:bg-green-100 border-green-200'
                  : 'text-gray-500 hover:text-gray-800 bg-white/50 hover:bg-white hover:border-gray-200'
              }`}
            title={hasCustomKey ? '使用自訂 Key' : '使用系統 Key (設定)'}
            aria-label="開啟設定"
          >
            <Settings className="w-5 h-5" />
            {hasCustomKey && <span className="text-xs font-medium pr-1">Custom Key</span>}
          </button>
          <button
            onClick={handleReset}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white bg-white/50 rounded-full transition-all shadow-sm border border-transparent hover:border-gray-200"
            title="重置畫布"
            aria-label="重置"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Settings */}
        <div className="lg:col-span-5 space-y-6">
          <ImageUpload
            sourceImage={sourceImage}
            onImageUpload={handleImageUpload}
            onDrop={handleDrop}
          />

          <AnimationConfigPanel
            config={config}
            setConfig={setConfig}
            removeBackground={removeBackground}
            setRemoveBackground={setRemoveBackground}
            isGenerating={isGenerating}
            statusText={statusText}
            error={error}
            onGenerate={handleGenerate}
          />
        </div>

        {/* Right Column: Result Preview */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Sprite Sheet Viewer (Only in Sheet Mode) */}
          {config.mode === 'sheet' && (
            <SpriteSheetViewer
              spriteSheetImage={spriteSheetImage}
              isGenerating={isGenerating}
              sheetDimensions={sheetDimensions}
              sliceSettings={sliceSettings}
              setSliceSettings={setSliceSettings}
              onImageLoad={handleImageLoad}
              onDownload={wrappedDownloadSpriteSheet}
            />
          )}

          {/* Animation Preview */}
          <div className="space-y-6">
            <AnimationPreview
              generatedFrames={generatedFrames}
              currentFrameIndex={currentFrameIndex}
              isGenerating={isGenerating}
              statusText={statusText}
              isPlaying={isPlaying}
              isExporting={isExporting}
              config={config}
              onTogglePlay={togglePlay}
              onDownloadApng={wrappedDownloadApng}
              onDownloadGif={wrappedDownloadGif}
              onDownloadZip={wrappedDownloadZip}
            />

            {/* Frame Grid */}
            {generatedFrames.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <FrameGrid
                  frames={generatedFrames}
                  currentFrameIndex={currentFrameIndex}
                  onFrameClick={handleFrameClick}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
