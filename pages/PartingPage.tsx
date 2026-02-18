import React, { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Loader2, Download, Check, FileArchive, Grid } from '../components/Icons';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../hooks/useSettings';
import { ImageUpload } from '../components/ImageUpload';
import { useSpriteSheet } from '../hooks/useSpriteSheet';
import { useLineStickerDownload } from '../hooks/useLineStickerDownload';
import { optimizeSliceSettings } from '../utils/imageUtils';
import { DEFAULT_SLICE_SETTINGS } from '../utils/constants';
import { logger } from '../utils/logger';
import type { SliceSettings } from '../utils/imageUtils';
import type { ChromaKeyColorType } from '../types';

const SpriteSheetViewer = lazy(() =>
  import('../components/SpriteSheetViewer').then((m) => ({ default: m.SpriteSheetViewer }))
);
const FrameGrid = lazy(() =>
  import('../components/FrameGrid').then((m) => ({ default: m.FrameGrid }))
);

const PartingPage: React.FC = () => {
  const { t } = useLanguage();
  const {
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    outputResolution,
    setOutputResolution,
    showSettings,
    setShowSettings,
    saveSettings,
  } = useSettings();

  const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
  const [sliceSettings, setSliceSettings] = useState<SliceSettings>(DEFAULT_SLICE_SETTINGS);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('green');
  const [frameIncluded, setFrameIncluded] = useState<boolean[]>([]);
  const [currentGridIndex, setCurrentGridIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [optimizeStatus, setOptimizeStatus] = useState<string | null>(null);

  const {
    generatedFrames,
    sheetDimensions,
    handleImageLoad,
    processedSpriteSheet,
    chromaKeyProgress,
    isProcessingChromaKey,
    frameOverrides,
    setFrameOverrides,
  } = useSpriteSheet(
    spriteSheetImage,
    sliceSettings,
    removeBackground,
    'sheet',
    chromaKeyColor
  );

  const {
    isDownloading,
    downloadAllAsZip,
    downloadSelectedAsZip,
  } = useLineStickerDownload({
    stickerFrames: generatedFrames,
    sheetFrames: [],
    stickerSetMode: false,
    currentSheetIndex: 0,
    processedSheetImages: [],
    sheetImages: [],
    setError,
  });

  // Sync frameIncluded when frame count changes
  useEffect(() => {
    if (generatedFrames.length > 0) {
      setFrameIncluded((prev) => {
        if (prev.length === generatedFrames.length) return prev;
        return new Array(generatedFrames.length).fill(true);
      });
    } else {
      setFrameIncluded([]);
    }
  }, [generatedFrames.length]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSpriteSheetImage((event.target?.result as string) ?? null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSpriteSheetImage((event.target?.result as string) ?? null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onDownloadSpriteSheet = useCallback(
    (isProcessed: boolean) => {
      const img = isProcessed ? processedSpriteSheet : spriteSheetImage;
      if (!img) return;
      const a = document.createElement('a');
      a.href = img;
      a.download = `sprite-sheet-${isProcessed ? 'processed' : 'original'}.png`;
      a.click();
    },
    [processedSpriteSheet, spriteSheetImage]
  );

  const onDownloadOriginal = useCallback(() => {
    if (!spriteSheetImage) return;
    const a = document.createElement('a');
    a.href = spriteSheetImage;
    a.download = 'sprite-sheet-original.png';
    a.click();
  }, [spriteSheetImage]);

  const handleOptimizeSlice = useCallback(async () => {
    const image = processedSpriteSheet ?? spriteSheetImage;
    if (!image) return;
    setOptimizeStatus(t.statusOptimizing);
    try {
      const optimized = await optimizeSliceSettings(
        image,
        sliceSettings.cols,
        sliceSettings.rows
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
      setOptimizeStatus(t.statusOptimized);
      setTimeout(() => setOptimizeStatus(null), 2000);
    } catch (err) {
      logger.warn('Optimize slice failed', err);
      setOptimizeStatus(null);
    }
  }, [processedSpriteSheet, spriteSheetImage, sliceSettings.cols, sliceSettings.rows, t]);

  const handleFrameClick = useCallback((index: number) => {
    setCurrentGridIndex(index);
  }, []);

  const selectedIndices = useMemo(
    () => frameIncluded.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
    [frameIncluded]
  );

  const displayImage = processedSpriteSheet ?? spriteSheetImage;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 font-sans overflow-x-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:px-6 lg:px-8 md:pt-6 lg:pt-8 md:pb-6 lg:pb-8">
      <SettingsModal
        apiKey={apiKey}
        setApiKey={setApiKey}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        outputResolution={outputResolution}
        setOutputResolution={setOutputResolution}
        showSettings={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(key, model, token, res) => saveSettings(key, model, token, res)}
      />

      <header className="sticky top-0 z-20 max-w-7xl mx-auto mb-4 md:mb-8 -mx-4 px-4 md:mx-0 md:px-0 safe-top">
        <div className="bg-white/95 backdrop-blur-md rounded-xl md:rounded-2xl shadow-sm border border-slate-200/60 p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2 safe-left safe-right">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              to="/"
              className="min-h-[44px] min-w-[44px] p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200 hover:border-slate-300 flex items-center justify-center"
              title={t.backToHome}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 truncate">
              <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-1.5 sm:p-2 rounded-lg md:rounded-xl shadow-md flex-shrink-0">
                <Grid className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {t.partingTitle}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <button
              onClick={() => setShowSettings(true)}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl transition-all duration-200 shadow-sm border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center"
              title={t.settings}
              aria-label={t.settings}
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
        <div className="lg:col-span-5 space-y-4 sm:space-y-5 md:space-y-6">
          <ImageUpload
            sourceImage={spriteSheetImage}
            onImageUpload={handleImageUpload}
            onDrop={handleDrop}
          />

          {spriteSheetImage && (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t.sliceSettings}</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeBackground}
                      onChange={(e) => setRemoveBackground(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{t.removeBackground}</span>
                  </label>
                  {removeBackground && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setChromaKeyColor('magenta')}
                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                          chromaKeyColor === 'magenta'
                            ? 'border-pink-400 bg-pink-50 text-pink-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-[#FF00FF]" />
                        {t.magentaColor}
                        {chromaKeyColor === 'magenta' && <Check className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChromaKeyColor('green')}
                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                          chromaKeyColor === 'green'
                            ? 'border-green-400 bg-green-50 text-green-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-[#00FF00]" />
                        {t.greenScreen}
                        {chromaKeyColor === 'green' && <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {displayImage && (
                <Suspense
                  fallback={
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center min-h-[200px]">
                      <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                    </div>
                  }
                >
                  <SpriteSheetViewer
                    spriteSheetImage={displayImage}
                    originalSpriteSheet={spriteSheetImage}
                    isGenerating={false}
                    sheetDimensions={sheetDimensions}
                    sliceSettings={sliceSettings}
                    setSliceSettings={setSliceSettings}
                    onImageLoad={handleImageLoad}
                    onDownload={onDownloadSpriteSheet}
                    onDownloadOriginal={onDownloadOriginal}
                    chromaKeyProgress={chromaKeyProgress}
                    isProcessingChromaKey={isProcessingChromaKey}
                  />
                </Suspense>
              )}

              {displayImage && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleOptimizeSlice}
                    disabled={!!optimizeStatus && optimizeStatus !== t.statusOptimized}
                    className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-400 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {optimizeStatus === t.statusOptimizing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {optimizeStatus ?? t.partingOptimizeButton}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-200 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="px-2 py-1 rounded hover:bg-red-100 text-red-700"
                aria-label={t.reset}
              >
                ×
              </button>
            </div>
          )}

          {generatedFrames.length > 0 ? (
            <>
              <Suspense
                fallback={
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center min-h-[300px]">
                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                  </div>
                }
              >
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.gridSliceSettings}</h2>
                  <FrameGrid
                    frames={generatedFrames}
                    currentFrameIndex={currentGridIndex}
                    onFrameClick={handleFrameClick}
                    frameOverrides={frameOverrides}
                    setFrameOverrides={setFrameOverrides}
                    enablePerFrameEdit={true}
                    processedSpriteSheet={processedSpriteSheet}
                    sliceSettings={sliceSettings}
                    sheetDimensions={sheetDimensions}
                    frameIncluded={frameIncluded}
                    setFrameIncluded={setFrameIncluded}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={downloadAllAsZip}
                      disabled={isDownloading || generatedFrames.length === 0}
                      className="px-5 py-2.5 bg-teal-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-teal-600 disabled:opacity-50 transition-all shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      {t.lineStickerDownloadAll}
                    </button>
                    <button
                      onClick={() => downloadSelectedAsZip(selectedIndices)}
                      disabled={isDownloading || selectedIndices.length === 0}
                      className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      {t.lineStickerDownloadSelected.replace('{n}', String(selectedIndices.length))}
                    </button>
                  </div>
                </div>
              </Suspense>
            </>
          ) : (
            <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <FileArchive className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm font-medium text-slate-500">{t.partingDesc}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PartingPage;
