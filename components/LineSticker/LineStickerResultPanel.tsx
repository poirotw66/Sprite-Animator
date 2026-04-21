import React, { Suspense, useCallback, useRef, useState } from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Plus, Loader2 } from '../Icons';
import type { AutoSliceFallbackHint, SliceSettings, FrameOverride } from '../../utils/imageUtils';
import type { Translations } from '../../i18n/types';
import { LineStickerDownloadSection } from './LineStickerDownloadSection';
import { LineStickerResultEmptyState } from './LineStickerResultEmptyState';
import {
  LineStickerSetOverviewPanel,
  type LineStickerSetOverviewItem,
} from './LineStickerSetOverviewPanel';
import { RenderProfiler } from '../RenderProfiler';
import {
  LINE_STICKER_SHEET_INDICES,
  type LineStickerSheetIndex,
} from '../../utils/lineStickerSetSchema';

const FrameGrid = lazyWithRetry(() =>
  import('../FrameGrid').then((module) => ({ default: module.FrameGrid }))
);
const SpriteSheetViewer = lazyWithRetry(() =>
  import('../SpriteSheetViewer').then((module) => ({ default: module.SpriteSheetViewer }))
);

export interface LineStickerResultPanelSheetViewModel {
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  setCurrentSheetIndex: (index: LineStickerSheetIndex) => void;
  onSelectOverviewSheet: (index: LineStickerSheetIndex) => void;
  onRetrySheet: (index: LineStickerSheetIndex) => void;
  overviewItems: LineStickerSetOverviewItem[];
}

export interface LineStickerResultPanelStatusViewModel {
  error: string | null;
  statusText: string;
  isGenerating: boolean;
  isDownloading: boolean;
}

export interface LineStickerResultPanelViewerViewModel {
  effectiveSpriteSheetImage: string | null;
  effectiveProcessedSpriteSheet: string | null;
  effectiveStickerFrames: string[];
  effectiveSelectedFrames: boolean[];
  effectiveSetSelectedFrames: React.Dispatch<React.SetStateAction<boolean[]>>;
  effectiveFrameOverrides: FrameOverride[];
  effectiveSetFrameOverrides: React.Dispatch<React.SetStateAction<FrameOverride[]>>;
  effectiveSliceSettingsForView: SliceSettings;
  effectiveSetSliceSettingsForView: React.Dispatch<React.SetStateAction<SliceSettings>>;
  effectiveSheetDimensions: { width: number; height: number };
  effectiveChromaKeyProgress: number;
  effectiveIsProcessingChromaKey: boolean;
  effectiveAutoSliceHint: AutoSliceFallbackHint | null;
  onApplyAutoSliceHint: () => void;
  lockGridSize: boolean;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onReplaceOriginalImage: (dataUrl: string) => void;
  onReplaceProcessedImage: (dataUrl: string) => void;
  onApplyReprocessedImage: (dataUrl: string) => void;
  onReRunChromaKey: (image: string) => Promise<string>;
  onSpriteSheetUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface LineStickerResultPanelDownloadViewModel {
  processedSheetImages: (string | null)[];
  processedSheetImagesCurrent: string | null;
  sheetFrames: string[][];
  selectedCount: number;
  selectedIndices: number[];
  selectAll: () => void;
  deselectAll: () => void;
  onDownloadSetOneClick: () => void;
  onDownloadStickerSetZip: () => void;
  onDownloadAllSheetsFramesZip: () => void;
  onDownloadCurrentSheetZip: () => void;
  onDownloadAllAsZip: () => void;
  onDownloadSelectedAsZip: (indices: number[]) => void;
}

export interface LineStickerResultPanelViewModel {
  sheet: LineStickerResultPanelSheetViewModel;
  status: LineStickerResultPanelStatusViewModel;
  viewer: LineStickerResultPanelViewerViewModel;
  downloads: LineStickerResultPanelDownloadViewModel;
}

export interface LineStickerResultPanelProps {
  t: Translations;
  viewModel: LineStickerResultPanelViewModel;
}

interface LineStickerResultViewerSectionProps {
  t: Translations;
  sheet: LineStickerResultPanelSheetViewModel;
  status: LineStickerResultPanelStatusViewModel;
  viewer: LineStickerResultPanelViewerViewModel;
  downloads: LineStickerResultPanelDownloadViewModel;
}

interface LineStickerResultDownloadsSectionProps {
  t: Translations;
  sheet: LineStickerResultPanelSheetViewModel;
  status: LineStickerResultPanelStatusViewModel;
  viewer: LineStickerResultPanelViewerViewModel;
  downloads: LineStickerResultPanelDownloadViewModel;
}

const LineStickerResultViewerSection: React.FC<LineStickerResultViewerSectionProps> = React.memo(({
  t,
  sheet,
  status,
  viewer,
  downloads,
}) => {
  const [showOriginalInSpriteView, setShowOriginalInSpriteView] = useState(false);

  const handleDownloadImage = useCallback((image: string | null, filename: string) => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = filename;
    link.click();
  }, []);

  const handleReRunCurrentChromaKey = useCallback(async () => {
    if (!viewer.effectiveSpriteSheetImage) {
      return;
    }

    try {
      const result = await viewer.onReRunChromaKey(viewer.effectiveSpriteSheetImage);
      viewer.onApplyReprocessedImage(result);
    } catch {
      // Error state is already handled by caller hook.
    }
  }, [viewer]);

  return (
    <RenderProfiler id="LineStickerResultViewer">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setShowOriginalInSpriteView((prev) => !prev)}
            className={`text-xs px-3 py-1.5 rounded-lg border-2 transition-all ${
              showOriginalInSpriteView
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {showOriginalInSpriteView ? t.lineStickerShowProcessed : t.lineStickerShowOriginal}
          </button>
          <button
            onClick={() =>
              handleDownloadImage(
                viewer.effectiveSpriteSheetImage,
                `sprite-sheet-${sheet.stickerSetMode ? sheet.currentSheetIndex + 1 : 'single'}-original.png`
              )
            }
            disabled={!viewer.effectiveSpriteSheetImage}
            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t.downloadOriginal}
          </button>
          <button
            onClick={() =>
              handleDownloadImage(
                viewer.effectiveProcessedSpriteSheet,
                `sprite-sheet-${sheet.stickerSetMode ? sheet.currentSheetIndex + 1 : 'single'}-processed.png`
              )
            }
            disabled={!viewer.effectiveProcessedSpriteSheet}
            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
          >
            {t.downloadProcessed}
          </button>
          <button
            type="button"
            disabled={viewer.effectiveIsProcessingChromaKey || !viewer.effectiveSpriteSheetImage}
            onClick={handleReRunCurrentChromaKey}
            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-teal-600 hover:bg-teal-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {viewer.effectiveIsProcessingChromaKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {t.spriteSheetReRunChromaKey}
          </button>
        </div>

        <Suspense fallback={<div className="aspect-video bg-slate-50 rounded-xl animate-pulse" />}>
          <SpriteSheetViewer
            spriteSheetImage={showOriginalInSpriteView
              ? viewer.effectiveSpriteSheetImage
              : viewer.effectiveProcessedSpriteSheet || viewer.effectiveSpriteSheetImage}
            onImageLoad={viewer.onImageLoad}
            isGenerating={status.isGenerating}
            sliceSettings={viewer.effectiveSliceSettingsForView}
            setSliceSettings={viewer.effectiveSetSliceSettingsForView}
            lockGridSize={viewer.lockGridSize}
            onEditedImage={(dataUrl: string) => {
              if (showOriginalInSpriteView) {
                viewer.onReplaceOriginalImage(dataUrl);
                return;
              }
              viewer.onReplaceProcessedImage(dataUrl);
            }}
            chromaKeyProgress={viewer.effectiveChromaKeyProgress}
            isProcessingChromaKey={viewer.effectiveIsProcessingChromaKey}
            autoSliceHint={viewer.effectiveAutoSliceHint}
            onApplyAutoSliceHint={viewer.onApplyAutoSliceHint}
            sheetDimensions={viewer.effectiveSheetDimensions}
            onDownload={(isProcessed: boolean) => {
              handleDownloadImage(
                isProcessed ? viewer.effectiveProcessedSpriteSheet : viewer.effectiveSpriteSheetImage,
                `sprite-sheet-${isProcessed ? 'processed' : 'original'}.png`
              );
            }}
          />
        </Suspense>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              {t.lineStickerPreviewCropped}
              <span className="text-xs font-normal text-slate-500">{t.lineStickerPreviewCropHint}</span>
            </h3>
            <div className="flex gap-2">
              <button onClick={downloads.selectAll} className="text-xs font-semibold text-green-600 hover:text-green-700">
                {t.lineStickerSelectAll}
              </button>
              <button onClick={downloads.deselectAll} className="text-xs font-semibold text-slate-500 hover:text-slate-600">
                {t.lineStickerDeselectAll}
              </button>
            </div>
          </div>
          <Suspense fallback={<div className="grid grid-cols-4 gap-2"><div className="aspect-square bg-slate-50 animate-pulse rounded-lg" /></div>}>
            <FrameGrid
              frames={viewer.effectiveStickerFrames}
              currentFrameIndex={0}
              onFrameClick={() => {}}
              frameIncluded={viewer.effectiveSelectedFrames}
              setFrameIncluded={viewer.effectiveSetSelectedFrames}
              frameOverrides={viewer.effectiveFrameOverrides}
              setFrameOverrides={viewer.effectiveSetFrameOverrides}
              enablePerFrameEdit={true}
              processedSpriteSheet={viewer.effectiveProcessedSpriteSheet}
              sliceSettings={viewer.effectiveSliceSettingsForView}
              sheetDimensions={viewer.effectiveSheetDimensions}
            />
          </Suspense>
        </div>
      </div>
    </RenderProfiler>
  );
});

LineStickerResultViewerSection.displayName = 'LineStickerResultViewerSection';

const LineStickerResultDownloadsSection: React.FC<LineStickerResultDownloadsSectionProps> = React.memo(({
  t,
  sheet,
  status,
  viewer,
  downloads,
}) => (
  <RenderProfiler id="LineStickerResultDownloads">
    <LineStickerDownloadSection
      t={t}
      stickerSetMode={sheet.stickerSetMode}
      isDownloading={status.isDownloading}
      processedSheetImages={downloads.processedSheetImages}
      sheetFrames={downloads.sheetFrames}
      processedSheetImagesCurrent={downloads.processedSheetImagesCurrent}
      stickerFramesLength={viewer.effectiveStickerFrames.length}
      selectedCount={downloads.selectedCount}
      onDownloadSetOneClick={downloads.onDownloadSetOneClick}
      onDownloadStickerSetZip={downloads.onDownloadStickerSetZip}
      onDownloadAllSheetsFramesZip={downloads.onDownloadAllSheetsFramesZip}
      onDownloadCurrentSheetZip={downloads.onDownloadCurrentSheetZip}
      onDownloadAllAsZip={downloads.onDownloadAllAsZip}
      onDownloadSelectedAsZip={downloads.onDownloadSelectedAsZip}
      selectedIndices={downloads.selectedIndices}
    />
  </RenderProfiler>
));

LineStickerResultDownloadsSection.displayName = 'LineStickerResultDownloadsSection';

export const LineStickerResultPanel: React.FC<LineStickerResultPanelProps> = React.memo(({
  t,
  viewModel,
}) => {
  const { sheet, status, viewer, downloads } = viewModel;
  const spriteSheetFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.lineStickerResult}</h2>
        {sheet.stickerSetMode && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {LINE_STICKER_SHEET_INDICES.map((index) => (
              <button
                key={index}
                onClick={() => sheet.setCurrentSheetIndex(index)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  sheet.currentSheetIndex === index
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.lineStickerSheetN.replace('{n}', String(index + 1))}
              </button>
            ))}
          </div>
        )}
      </div>

      {status.error ? (
        <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <Plus className="w-5 h-5 rotate-45" />
          {status.error}
        </div>
      ) : null}
      {status.statusText ? (
        <div className="mb-4 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          {status.statusText}
        </div>
      ) : null}

      {sheet.stickerSetMode ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerSetOverviewTitle}</h3>
            <p className="mt-1 text-xs text-slate-500">{t.lineStickerSetOverviewHint}</p>
          </div>
          <LineStickerSetOverviewPanel
            t={t}
            items={sheet.overviewItems}
            currentSheetIndex={sheet.currentSheetIndex}
            onSelectSheet={sheet.onSelectOverviewSheet}
            onRetrySheet={sheet.onRetrySheet}
            isGenerating={status.isGenerating}
            compact
          />
        </div>
      ) : null}

      {viewer.effectiveSpriteSheetImage ? (
        <div className="space-y-8">
          <LineStickerResultViewerSection
            t={t}
            sheet={sheet}
            status={status}
            viewer={viewer}
            downloads={downloads}
          />
          <LineStickerResultDownloadsSection
            t={t}
            sheet={sheet}
            status={status}
            viewer={viewer}
            downloads={downloads}
          />
        </div>
      ) : (
        <LineStickerResultEmptyState
          placeholderText={t.spriteSheetPlaceholder}
          uploadButtonText={t.lineStickerUploadSpriteSheet}
          uploadHint={t.lineStickerUploadSpriteSheetHint}
          onUploadClick={() => spriteSheetFileInputRef.current?.click()}
          onFileChange={viewer.onSpriteSheetUpload}
          fileInputRef={spriteSheetFileInputRef}
        />
      )}
    </div>
  );
});

LineStickerResultPanel.displayName = 'LineStickerResultPanel';