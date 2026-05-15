import React, { Suspense, useCallback, useRef, useState } from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Plus, Loader2 } from '../Icons';
import type { SliceSettings, FrameOverride } from '../../utils/imageUtils';
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
import { LineStickerPhraseGridEditor } from './LineStickerPhraseSection';

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

export interface LineStickerResultSidePhraseEdit {
  phraseGridList: string[];
  actionDescGridList: string[];
  phraseGridCols: number;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
  currentSheetIndex: LineStickerSheetIndex;
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
  lockGridSize: boolean;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onReplaceOriginalImage: (dataUrl: string) => void;
  onReplaceProcessedImage: (dataUrl: string) => void;
  onApplyReprocessedImage: (dataUrl: string) => void;
  onReRunChromaKey: (image: string) => Promise<string>;
  onSpriteSheetUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  useFrameImageForSingleCanvas: boolean;
  /** Single-sheet programmatic: font/style controls inside the per-frame crop edit portal. */
  frameEditProgrammaticStyleSlot: React.ReactNode | null;
  resultSidePhraseEdit: LineStickerResultSidePhraseEdit | null;
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
          <button
            type="button"
            onClick={() => setShowOriginalInSpriteView((prev) => !prev)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              showOriginalInSpriteView
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {showOriginalInSpriteView ? t.lineStickerShowProcessed : t.lineStickerShowOriginal}
          </button>
          <button
            type="button"
            onClick={() =>
              handleDownloadImage(
                viewer.effectiveSpriteSheetImage,
                `sprite-sheet-${sheet.stickerSetMode ? sheet.currentSheetIndex + 1 : 'single'}-original.png`
              )
            }
            disabled={!viewer.effectiveSpriteSheetImage}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.downloadOriginal}
          </button>
          <button
            type="button"
            onClick={() =>
              handleDownloadImage(
                viewer.effectiveProcessedSpriteSheet,
                `sprite-sheet-${sheet.stickerSetMode ? sheet.currentSheetIndex + 1 : 'single'}-processed.png`
              )
            }
            disabled={!viewer.effectiveProcessedSpriteSheet}
            className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.downloadProcessed}
          </button>
          <button
            type="button"
            disabled={viewer.effectiveIsProcessingChromaKey || !viewer.effectiveSpriteSheetImage}
            onClick={handleReRunCurrentChromaKey}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200/80 bg-teal-50/60 px-3 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {viewer.effectiveIsProcessingChromaKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
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
            sheetDimensions={viewer.effectiveSheetDimensions}
            onDownload={(isProcessed: boolean) => {
              handleDownloadImage(
                isProcessed ? viewer.effectiveProcessedSpriteSheet : viewer.effectiveSpriteSheetImage,
                `sprite-sheet-${isProcessed ? 'processed' : 'original'}.png`
              );
            }}
          />
        </Suspense>

        {viewer.resultSidePhraseEdit ? (
          <div className="space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerResultProgrammaticPhrasesTitle}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t.lineStickerResultProgrammaticPhrasesHint}</p>
            </div>
            <LineStickerPhraseGridEditor
              t={t}
              stickerSetMode={sheet.stickerSetMode}
              currentSheetIndex={viewer.resultSidePhraseEdit.currentSheetIndex}
              phraseGridList={viewer.resultSidePhraseEdit.phraseGridList}
              actionDescGridList={viewer.resultSidePhraseEdit.actionDescGridList}
              phraseGridCols={viewer.resultSidePhraseEdit.phraseGridCols}
              updatePhraseAt={viewer.resultSidePhraseEdit.updatePhraseAt}
              updateActionDescAt={viewer.resultSidePhraseEdit.updateActionDescAt}
            />
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">{t.lineStickerPreviewCropped}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t.lineStickerPreviewCropHint}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={downloads.selectAll} className="text-xs font-semibold text-green-700 hover:text-green-800">
                {t.lineStickerSelectAll}
              </button>
              <span className="hidden h-3 w-px bg-slate-200 sm:block" aria-hidden />
              <button type="button" onClick={downloads.deselectAll} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
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
              useFrameImageForSingleCanvas={viewer.useFrameImageForSingleCanvas}
              perFrameEditExtra={viewer.frameEditProgrammaticStyleSlot}
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
    <div className="min-h-[480px] scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t.lineStickerResult}</h2>
        {sheet.stickerSetMode && (
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {LINE_STICKER_SHEET_INDICES.map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => sheet.setCurrentSheetIndex(index)}
                className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                  sheet.currentSheetIndex === index
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.lineStickerSheetN.replace('{n}', String(index + 1))}
              </button>
            ))}
          </div>
        )}
      </div>

      {status.error ? (
        <div className="mb-4 flex animate-in items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800 slide-in-from-top-2">
          <Plus className="h-5 w-5 shrink-0 rotate-45" />
          {status.error}
        </div>
      ) : null}
      {status.statusText ? (
        <div className="mb-4 flex animate-in items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-900 slide-in-from-top-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          {status.statusText}
        </div>
      ) : null}

      {sheet.stickerSetMode ? (
        <div className="mb-5 rounded-xl border border-slate-200/90 bg-slate-50/70 p-4">
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
        <div className="space-y-6">
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