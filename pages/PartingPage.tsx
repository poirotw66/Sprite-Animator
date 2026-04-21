import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Loader2, Download, Check, FileArchive, Grid } from '../components/Icons';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../hooks/useSettings';
import { ImageUpload } from '../components/ImageUpload';
import { useSpriteSheetFlow } from '../hooks/useSpriteSheetFlow';
import { useLineStickerDownload } from '../hooks/useLineStickerDownload';

const SpriteSheetViewer = lazyWithRetry(() =>
  import('../components/SpriteSheetViewer').then((m) => ({ default: m.SpriteSheetViewer }))
);
const FrameGrid = lazyWithRetry(() =>
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

  const [currentGridIndex, setCurrentGridIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [optimizeStatus, setOptimizeStatus] = useState<string | null>(null);

  const flow = useSpriteSheetFlow({ runChromaAutomatically: true });
  const { setImage } = flow;

  const {
    isDownloading,
    downloadAllAsZip,
    downloadSelectedAsZip,
  } = useLineStickerDownload({
    stickerFrames: flow.frames,
    sheetFrames: [],
    stickerSetMode: false,
    currentSheetIndex: 0,
    processedSheetImages: [],
    sheetImages: [],
    setError,
  });

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage((event.target?.result as string) ?? null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, [setImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage((event.target?.result as string) ?? null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, [setImage]);

  const onDownloadSpriteSheet = useCallback(
    (isProcessed: boolean) => {
      const img = isProcessed ? flow.processedImage : flow.image;
      if (!img) return;
      const a = document.createElement('a');
      a.href = img;
      a.download = `sprite-sheet-${isProcessed ? 'processed' : 'original'}.png`;
      a.click();
    },
    [flow.processedImage, flow.image]
  );

  const onDownloadOriginal = useCallback(() => {
    if (!flow.image) return;
    const a = document.createElement('a');
    a.href = flow.image;
    a.download = 'sprite-sheet-original.png';
    a.click();
  }, [flow.image]);

  const handleOptimizeSlice = useCallback(async () => {
    setOptimizeStatus(t.statusOptimizing);
    try {
      await flow.optimizeSlice();
      setOptimizeStatus(t.statusOptimized);
      setTimeout(() => setOptimizeStatus(null), 2000);
    } catch {
      setOptimizeStatus(null);
    }
  }, [flow, t.statusOptimizing, t.statusOptimized]);

  const handleFrameClick = useCallback((index: number) => {
    setCurrentGridIndex(index);
  }, []);

  const selectedIndices = useMemo(
    () => flow.frameIncluded.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
    [flow.frameIncluded]
  );

  const displayImage = flow.processedImage ?? flow.image;

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
            sourceImage={flow.image}
            onImageUpload={handleImageUpload}
            onDrop={handleDrop}
          />

          {flow.image && (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t.sliceSettings}</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flow.removeBackground}
                      onChange={(e) => flow.setRemoveBackground(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{t.removeBackground}</span>
                  </label>
                  {flow.removeBackground && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => flow.setChromaKeyColor('magenta')}
                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                          flow.chromaKeyColor === 'magenta'
                            ? 'border-pink-400 bg-pink-50 text-pink-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-[#FF00FF]" />
                        {t.magentaColor}
                        {flow.chromaKeyColor === 'magenta' && <Check className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => flow.setChromaKeyColor('green')}
                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                          flow.chromaKeyColor === 'green'
                            ? 'border-green-400 bg-green-50 text-green-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-[#00FF00]" />
                        {t.greenScreen}
                        {flow.chromaKeyColor === 'green' && <Check className="w-4 h-4" />}
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
                    originalSpriteSheet={flow.image}
                    isGenerating={false}
                    sheetDimensions={flow.sheetDimensions}
                    sliceSettings={flow.sliceSettings}
                    setSliceSettings={flow.setSliceSettings}
                    onImageLoad={flow.handleImageLoad}
                    onDownload={onDownloadSpriteSheet}
                    onDownloadOriginal={onDownloadOriginal}
                    chromaKeyProgress={flow.chromaKeyProgress}
                    isProcessingChromaKey={flow.isProcessingChromaKey}
                    autoSliceHint={flow.autoSliceHint}
                    onApplyAutoSliceHint={flow.applyAutoSliceHint}
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
                ?
              </button>
            </div>
          )}

          {flow.frames.length > 0 ? (
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
                    frames={flow.frames}
                    currentFrameIndex={currentGridIndex}
                    onFrameClick={handleFrameClick}
                    frameOverrides={flow.frameOverrides}
                    setFrameOverrides={flow.setFrameOverrides}
                    enablePerFrameEdit={true}
                    processedSpriteSheet={flow.processedImage}
                    sliceSettings={flow.sliceSettings}
                    sheetDimensions={flow.sheetDimensions}
                    frameIncluded={flow.frameIncluded}
                    setFrameIncluded={flow.setFrameIncluded}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={downloadAllAsZip}
                      disabled={isDownloading || flow.frames.length === 0}
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
