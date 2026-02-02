import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { RefreshCw, Settings, Zap, Loader2, Save } from './components/Icons';
import { SettingsModal } from './components/SettingsModal';
import { ImageUpload } from './components/ImageUpload';
import { AnimationConfigPanel } from './components/AnimationConfig';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useLanguage } from './hooks/useLanguage';

// Lazy load heavy components for code splitting
const SpriteSheetViewer = lazy(() => 
  import('./components/SpriteSheetViewer').then(module => ({ default: module.SpriteSheetViewer }))
);
const AnimationPreview = lazy(() => 
  import('./components/AnimationPreview').then(module => ({ default: module.AnimationPreview }))
);
const FrameGrid = lazy(() => 
  import('./components/FrameGrid').then(module => ({ default: module.FrameGrid }))
);
import { generateAnimationFrames, generateSpriteSheet } from './services/geminiService';
import { AnimationConfig as AnimationConfigType } from './types';
import { useSettings } from './hooks/useSettings';
import { useAnimation } from './hooks/useAnimation';
import { useSpriteSheet } from './hooks/useSpriteSheet';
import { useExport } from './hooks/useExport';
import { useProjectHistory } from './hooks/useProjectHistory';
import { ProjectHistory } from './components/ProjectHistory';
import { DEFAULT_CONFIG, DEFAULT_SLICE_SETTINGS } from './utils/constants';
import { optimizeSliceSettings } from './utils/imageUtils';
import type { SavedProject } from './types';

const App: React.FC = () => {
  // Language
  const { t } = useLanguage();

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
    processedSpriteSheet, // Chroma-key-removed sprite sheet for display
    chromaKeyProgress, // Progress of chroma key removal (0-100)
    isProcessingChromaKey, // Whether chroma key removal is in progress
    frameOverrides,
    setFrameOverrides,
  } = useSpriteSheet(spriteSheetImage, sliceSettings, removeBackground, config.mode, config.chromaKeyColor);

  // Frame-by-frame mode frames
  const [frameModeFrames, setFrameModeFrames] = useState<string[]>([]);

  // Combined frames (from either mode)
  const generatedFrames = useMemo(() => {
    return config.mode === 'sheet' ? spriteSheetFrames : frameModeFrames;
  }, [config.mode, spriteSheetFrames, frameModeFrames]);

  // Per-frame include toggle for custom animation (which frames to use in playback/export)
  const [frameIncluded, setFrameIncluded] = useState<boolean[]>([]);
  const pendingLoadRef = useRef<{ frameOverrides: SavedProject['frameOverrides']; frameIncluded: boolean[] } | null>(null);

  useEffect(() => {
    if (pendingLoadRef.current) {
      const { frameOverrides: overrides, frameIncluded: included } = pendingLoadRef.current;
      if (generatedFrames.length === included.length) {
        setFrameOverrides(overrides as Parameters<typeof setFrameOverrides>[0]);
        setFrameIncluded(included);
        pendingLoadRef.current = null;
      }
      return;
    }
    setFrameIncluded((prev) => {
      const L = generatedFrames.length;
      if (prev.length === L) return prev;
      return Array(L).fill(true);
    });
  }, [generatedFrames.length, setFrameOverrides]);

  // Animation frames = only included; used for preview, playback, export
  const animationFrames = useMemo(
    () => generatedFrames.filter((_, i) => frameIncluded[i] !== false),
    [generatedFrames, frameIncluded]
  );

  // Animation hook (uses filtered frames)
  const { currentFrameIndex, setCurrentFrameIndex, handleFrameClick: onFrameClick } = useAnimation(
    animationFrames,
    config,
    isPlaying
  );

  // Export hook (uses filtered frames)
  const {
    isExporting,
    handleDownloadApng,
    handleDownloadGif,
    handleDownloadZip,
    handleDownloadSpriteSheet,
  } = useExport(animationFrames, config);

  // Map animation index -> grid index for FrameGrid highlight
  const currentGridIndex = useMemo(() => {
    const indices = generatedFrames.map((_, i) => i).filter((i) => frameIncluded[i] !== false);
    return indices[currentFrameIndex] ?? -1;
  }, [generatedFrames, frameIncluded, currentFrameIndex]);

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
      setError(t.errorApiKey);
      return;
    }

    if (!sourceImage) {
      setError(t.errorNoImage);
      return;
    }
    if (!config.prompt.trim()) {
      setError(t.errorNoPrompt);
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
        setStatusText(`${t.statusPreparing} (${t.statusUsingModel}: ${selectedModel})...`);

        const sheetImage = await generateSpriteSheet(
          sourceImage,
          config.prompt,
          config.gridCols,
          config.gridRows,
          effectiveKey,
          selectedModel,
          (status) => setStatusText(status),
          config.chromaKeyColor
        );

        setSpriteSheetImage(sheetImage);

        // Auto-optimize slice settings after generating sprite sheet
        try {
          setStatusText(t.statusOptimizing);
          const optimized = await optimizeSliceSettings(
            sheetImage,
            config.gridCols,
            config.gridRows
          );
          setSliceSettings((prev) => ({
            ...prev,
            paddingLeft: optimized.paddingLeft,
            paddingRight: optimized.paddingRight,
            paddingTop: optimized.paddingTop,
            paddingBottom: optimized.paddingBottom,
            paddingX: Math.round((optimized.paddingLeft + optimized.paddingRight) / 2),
            paddingY: Math.round((optimized.paddingTop + optimized.paddingBottom) / 2),
            shiftX: optimized.shiftX,
            shiftY: optimized.shiftY,
            autoOptimized: {
              paddingX: true,
              paddingY: true,
              shiftX: true,
              shiftY: true,
            },
          }));
          setStatusText(t.statusOptimized);
        } catch (err) {
          // If optimization fails, continue with default settings
          console.warn('Auto-optimization failed, using default settings:', err);
        }
      } else {
        // Frame by Frame mode
        setStatusText(`${t.statusGenerating} (${t.statusUsingModel}: ${selectedModel})`);
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
      let displayMsg = t.errorGeneration;

      if (
        rawMsg.includes('429') ||
        rawMsg.includes('Quota') ||
        rawMsg.includes('RESOURCE_EXHAUSTED')
      ) {
        displayMsg = t.errorRateLimit;
      } else {
        displayMsg = `${t.errorGeneration}: ${rawMsg}`;
      }

      setError(displayMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [
    t,
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

  // Handle frame click from grid (grid index -> animation index; only when frame is included)
  const handleFrameClick = useCallback(
    (gridIndex: number) => {
      if (frameIncluded[gridIndex] === false) return;
      const animIdx = frameIncluded.slice(0, gridIndex).filter(Boolean).length;
      onFrameClick(animIdx);
      setIsPlaying(false);
    },
    [onFrameClick, frameIncluded]
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Project history
  const { list: projectList, saveCurrent: saveProjectToHistory, loadProjectById, deleteProject, refreshList: refreshProjectList } = useProjectHistory();
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bottomSaveName, setBottomSaveName] = useState('');

  const handleSaveProject = useCallback(
    (name?: string) => {
      try {
        const snapshot: Omit<SavedProject, 'id' | 'name' | 'createdAt'> = {
          config,
          sliceSettings: { ...sliceSettings },
          removeBackground,
          sourceImage,
          spriteSheetImage,
          frameModeFrames,
          frameOverrides: [...frameOverrides],
          frameIncluded: [...frameIncluded],
        };
        const id = saveProjectToHistory(snapshot, name);
        if (id) {
          setError(null);
          setSaveError(null);
        } else {
          setSaveError(t.errorSaveProject);
        }
      } finally {
        setIsSavingProject(false);
      }
    },
    [config, sliceSettings, removeBackground, sourceImage, spriteSheetImage, frameModeFrames, frameOverrides, frameIncluded, saveProjectToHistory, t]
  );

  const handleLoadProject = useCallback((project: SavedProject) => {
    setConfig(project.config);
    setSliceSettings(project.sliceSettings as typeof sliceSettings);
    setRemoveBackground(project.removeBackground);
    setSourceImage(project.sourceImage);
    setSpriteSheetImage(project.spriteSheetImage);
    setFrameModeFrames(project.frameModeFrames);
    setError(null);
    setCurrentFrameIndex(0);
    pendingLoadRef.current = {
      frameOverrides: project.frameOverrides,
      frameIncluded: project.frameIncluded,
    };
  }, []);

  const canSaveProject = generatedFrames.length > 0;

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
      handleExportError(err instanceof Error ? err : new Error(t.errorExportApng));
    }
  }, [handleDownloadApng, handleExportError, t]);

  const wrappedDownloadGif = useCallback(async () => {
    try {
      await handleDownloadGif();
    } catch (err) {
      handleExportError(err instanceof Error ? err : new Error(t.errorExportGif));
    }
  }, [handleDownloadGif, handleExportError, t]);

  const wrappedDownloadZip = useCallback(async () => {
    try {
      await handleDownloadZip();
    } catch (err) {
      handleExportError(err instanceof Error ? err : new Error(t.errorExportZip));
    }
  }, [handleDownloadZip, handleExportError, t]);

  const wrappedDownloadSpriteSheet = useCallback(() => {
    // Download the processed (chroma-key-removed) version if available
    const imageToDownload = processedSpriteSheet || spriteSheetImage;
    if (imageToDownload) {
      handleDownloadSpriteSheet(imageToDownload);
    }
  }, [processedSpriteSheet, spriteSheetImage, handleDownloadSpriteSheet]);

  const wrappedDownloadOriginalSpriteSheet = useCallback(() => {
    // Download the original sprite sheet (before chroma key removal)
    if (spriteSheetImage) {
      handleDownloadSpriteSheet(spriteSheetImage);
    }
  }, [spriteSheetImage, handleDownloadSpriteSheet]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 font-sans overflow-x-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:px-6 lg:px-8 md:pt-6 lg:pt-8 md:pb-6 lg:pb-8">
      <SettingsModal
        apiKey={apiKey}
        setApiKey={setApiKey}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        showSettings={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
      />

      <header className="sticky top-0 z-20 max-w-7xl mx-auto mb-4 md:mb-8 -mx-4 px-4 md:mx-0 md:px-0 safe-top">
        <div className="bg-white/95 backdrop-blur-md rounded-xl md:rounded-2xl shadow-sm border border-slate-200/60 p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2 safe-left safe-right">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3 truncate min-w-0">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-1.5 sm:p-2 rounded-lg md:rounded-xl shadow-md flex-shrink-0">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {t.appTitle}
            </span>
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <ProjectHistory
              list={projectList}
              onSaveCurrent={(name) => { setIsSavingProject(true); handleSaveProject(name); }}
              loadProjectById={loadProjectById}
              onLoad={handleLoadProject}
              onDelete={deleteProject}
              canSave={canSaveProject}
              isSaving={isSavingProject}
              variant="header"
            />
            <LanguageSwitcher />
            <button
              onClick={() => setShowSettings(true)}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl transition-all duration-200 shadow-sm border flex items-center justify-center gap-2 cursor-pointer touch-manipulation tap-highlight
                ${
                  hasCustomKey
                    ? 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200 hover:shadow-md'
                    : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              title={hasCustomKey ? t.useCustomKey : t.useSystemKey}
              aria-label={t.settings}
            >
              <Settings className="w-5 h-5" />
              {hasCustomKey && <span className="text-xs font-semibold pr-1">{t.customKey}</span>}
            </button>
            <button
              onClick={handleReset}
              className="min-h-[44px] min-w-[44px] p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md cursor-pointer flex items-center justify-center touch-manipulation tap-highlight"
              title={t.reset}
              aria-label={t.reset}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
        <div className="lg:col-span-5 space-y-4 sm:space-y-5 md:space-y-6">
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

        <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 md:gap-6 min-w-0">
          {/* Sprite Sheet Viewer (Only in Sheet Mode) */}
          {config.mode === 'sheet' && (
            <Suspense
              fallback={
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center min-h-[200px]">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              }
            >
              <SpriteSheetViewer
                spriteSheetImage={processedSpriteSheet}
                originalSpriteSheet={spriteSheetImage}
                isGenerating={isGenerating}
                sheetDimensions={sheetDimensions}
                sliceSettings={sliceSettings}
                setSliceSettings={setSliceSettings}
                onImageLoad={handleImageLoad}
                onDownload={wrappedDownloadSpriteSheet}
                onDownloadOriginal={wrappedDownloadOriginalSpriteSheet}
                chromaKeyProgress={chromaKeyProgress}
                isProcessingChromaKey={isProcessingChromaKey}
              />
            </Suspense>
          )}

          {/* Animation Preview */}
          <div className="space-y-6">
            <Suspense
              fallback={
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center min-h-[500px]">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
              }
            >
              <AnimationPreview
                generatedFrames={animationFrames}
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
            </Suspense>

            {/* Frame Grid */}
            {generatedFrames.length > 0 && (
              <Suspense
                fallback={
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center min-h-[100px]">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                }
              >
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6 overflow-x-hidden">
                  <FrameGrid
                    frames={generatedFrames}
                    currentFrameIndex={currentGridIndex}
                    onFrameClick={handleFrameClick}
                    frameOverrides={frameOverrides}
                    setFrameOverrides={setFrameOverrides}
                    enablePerFrameEdit={config.mode === 'sheet'}
                    processedSpriteSheet={config.mode === 'sheet' ? processedSpriteSheet : undefined}
                    sliceSettings={config.mode === 'sheet' ? sliceSettings : undefined}
                    sheetDimensions={config.mode === 'sheet' ? sheetDimensions : undefined}
                    frameIncluded={frameIncluded}
                    setFrameIncluded={setFrameIncluded}
                  />
                  <div className="mt-4 space-y-2">
                    {saveError && (
                      <div className="flex items-center justify-between gap-2 text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200" role="alert">
                        <span>{saveError}</span>
                        <button
                          type="button"
                          onClick={() => setSaveError(null)}
                          className="flex-shrink-0 px-2 py-1 rounded hover:bg-red-100 text-red-600 font-medium"
                          aria-label={t.reset}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={bottomSaveName}
                        onChange={(e) => setBottomSaveName(e.target.value)}
                        placeholder={t.projectNamePlaceholder}
                        className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                        aria-label={t.projectNamePlaceholder}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsSavingProject(true);
                          setSaveError(null);
                          handleSaveProject(bottomSaveName.trim() || undefined);
                          setBottomSaveName('');
                        }}
                        disabled={!canSaveProject || isSavingProject}
                        className="min-h-[40px] px-4 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation tap-highlight"
                        aria-label={t.saveProject}
                      >
                        {isSavingProject ? <span className="animate-pulse">…</span> : <Save className="w-4 h-4" />}
                        {t.saveProject}
                      </button>
                    </div>
                  </div>
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
