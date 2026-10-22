import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { Loader2, Download, Check, FileArchive, Grid } from '../components/Icons';
import { useLanguage } from '../hooks/useLanguage';
import { ToolPageHeader } from '../components/ui';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../hooks/useSettings';
import { ImageUpload } from '../components/ImageUpload';
import { useSpriteSheetFlow } from '../hooks/useSpriteSheetFlow';
import { useLineStickerDownload } from '../hooks/useLineStickerDownload';
import { useSheetSliceProgrammaticOverlay } from '../hooks/useSheetSliceProgrammaticOverlay';
import { SheetSliceProgrammaticOverlayPanel } from '../components/SheetSliceProgrammaticOverlayPanel';
import {
  enterManualSliceMode,
} from '../utils/manualSliceMode';
import { enterRectsSliceMode } from '../utils/manualCellRects';

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
    openRouterApiKey,
    setOpenRouterApiKey,
    imageProvider,
    setImageProvider,
    selectedModel,
    setSelectedModel,
    outputResolution,
    setOutputResolution,
    stylePreviewResolution,
    setStylePreviewResolution,
    showSettings,
    setShowSettings,
    saveSettings,
  } = useSettings();

  const [currentGridIndex, setCurrentGridIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [optimizeStatus, setOptimizeStatus] = useState<string | null>(null);

  const sheetSliceOverlay = useSheetSliceProgrammaticOverlay();
  const flow = useSpriteSheetFlow({
    runChromaAutomatically: true,
    mapFramesAfterSlice: sheetSliceOverlay.mapFramesAfterSlice,
    slicePipelineRevision: sheetSliceOverlay.slicePipelineRevision,
  });
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
    if (flow.sliceSettings.sliceMode === 'manual' || flow.sliceSettings.sliceMode === 'rects') {
      return;
    }
    setOptimizeStatus(t.statusOptimizing);
    try {
      await flow.optimizeSlice();
      setOptimizeStatus(t.statusOptimized);
      setTimeout(() => setOptimizeStatus(null), 2000);
    } catch {
      setOptimizeStatus(null);
    }
  }, [flow, t.statusOptimizing, t.statusOptimized]);

  const sliceMode = flow.sliceSettings.sliceMode ?? 'equal';
  const isManualSlice = sliceMode === 'manual';
  const isRectsSlice = sliceMode === 'rects';
  const isFreeformSlice = isManualSlice || isRectsSlice;

  const setSliceModeEqual = useCallback(() => {
    flow.setSliceSettings((prev) => ({
      ...prev,
      sliceMode: 'equal',
      manualXBounds: undefined,
      manualYBounds: undefined,
      inferredCellRects: undefined,
    }));
  }, [flow]);

  const setSliceModeOwnership = useCallback(() => {
    flow.setSliceSettings((prev) => ({
      ...prev,
      sliceMode: 'ownership',
      manualXBounds: undefined,
      manualYBounds: undefined,
      inferredCellRects: undefined,
    }));
  }, [flow]);

  const setSliceModeManual = useCallback(() => {
    const { width, height } = flow.sheetDimensions;
    if (width <= 0 || height <= 0) return;
    flow.setSliceSettings((prev) => enterManualSliceMode(prev, width, height));
  }, [flow]);

  const setSliceModeRects = useCallback(() => {
    flow.setSliceSettings((prev) => enterRectsSliceMode(prev));
  }, [flow]);

  const handleFrameClick = useCallback((index: number) => {
    setCurrentGridIndex(index);
  }, []);

  const selectedIndices = useMemo(
    () => flow.frameIncluded.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
    [flow.frameIncluded]
  );

  const displayImage = flow.processedImage ?? flow.image;

  return (
    <div className="ui-page">
      <SettingsModal
        apiKey={apiKey}
        setApiKey={setApiKey}
        openRouterApiKey={openRouterApiKey}
        setOpenRouterApiKey={setOpenRouterApiKey}
        imageProvider={imageProvider}
        setImageProvider={setImageProvider}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        outputResolution={outputResolution}
        setOutputResolution={setOutputResolution}
        stylePreviewResolution={stylePreviewResolution}
        setStylePreviewResolution={setStylePreviewResolution}
        showSettings={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
      />

      <ToolPageHeader
        title={t.partingTitle}
        icon={<Grid />}
        onOpenSettings={() => setShowSettings(true)}
        settingsLabel={t.settings}
      />

      <main className="workspace-grid">
        <div className="min-w-0 space-y-5">
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
                      data-testid="parting-remove-background"
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
                            ? 'border-green-400 bg-signal-soft text-signal-hover'
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
                <>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">{t.gridSliceSettings}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={setSliceModeEqual}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          !isFreeformSlice && sliceMode !== 'ownership'
                            ? 'bg-teal-600 text-white border-teal-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                        aria-pressed={!isFreeformSlice && sliceMode !== 'ownership'}
                      >
                        {t.partingModeEqual}
                      </button>
                      <button
                        type="button"
                        onClick={setSliceModeOwnership}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          sliceMode === 'ownership'
                            ? 'bg-teal-600 text-white border-teal-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                        aria-pressed={sliceMode === 'ownership'}
                        title={t.sliceModeOwnershipHint}
                      >
                        {t.partingModeOwnership}
                      </button>
                      <button
                        type="button"
                        onClick={setSliceModeManual}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isManualSlice
                            ? 'bg-signal-hover text-white border-signal-hover'
                            : 'bg-white text-signal border-signal/25 hover:bg-signal-soft'
                        }`}
                        aria-pressed={isManualSlice}
                        title={t.sliceModeManualHint}
                      >
                        {t.partingModeManual}
                      </button>
                      <button
                        type="button"
                        onClick={setSliceModeRects}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isRectsSlice
                            ? 'bg-ok text-white border-ok'
                            : 'bg-white text-ok border-ok/25 hover:bg-ok-soft'
                        }`}
                        aria-pressed={isRectsSlice}
                        title={t.sliceModeRectsHint}
                      >
                        {t.partingModeRects}
                      </button>
                    </div>
                    {isManualSlice && (
                      <p className="text-xs text-signal leading-relaxed">{t.partingDrawHint}</p>
                    )}
                    {isRectsSlice && (
                      <p className="text-xs text-ok leading-relaxed">{t.partingRectsHint}</p>
                    )}
                  </div>

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
                    controlsAccent="teal"
                    hideSliceModeToggle
                  />
                </Suspense>
                </>
              )}

              {displayImage && !isFreeformSlice && (
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

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t.sheetSliceProgrammaticOverlayTitle}</h3>
                <SheetSliceProgrammaticOverlayPanel
                  t={t}
                  accent="teal"
                  enabled={sheetSliceOverlay.overlayEnabled}
                  onEnabledChange={sheetSliceOverlay.setOverlayEnabled}
                  linesText={sheetSliceOverlay.overlayLinesText}
                  onLinesTextChange={sheetSliceOverlay.setOverlayLinesText}
                  fontKey={sheetSliceOverlay.overlayFontKey}
                  onFontKeyChange={sheetSliceOverlay.setOverlayFontKey}
                  colorKey={sheetSliceOverlay.overlayColorKey}
                  onColorKeyChange={sheetSliceOverlay.setOverlayColorKey}
                  tuning={sheetSliceOverlay.overlayTuning}
                  onTuningChange={sheetSliceOverlay.setOverlayTuning}
                />
              </div>
            </>
          )}
        </div>

        <div className="min-w-0 flex flex-col gap-4">
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
                    useFrameImageForSingleCanvas={sheetSliceOverlay.useFrameImageForSingleCanvas}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      data-testid="parting-download-all"
                      onClick={downloadAllAsZip}
                      disabled={isDownloading || flow.frames.length === 0}
                      className="px-5 py-2.5 bg-teal-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-teal-600 disabled:opacity-50 transition-all shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      {t.lineStickerDownloadAll}
                    </button>
                    <button
                      data-testid="parting-download-selected"
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
