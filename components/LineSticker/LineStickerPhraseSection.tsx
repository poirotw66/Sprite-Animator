import React from 'react';
import { Loader2, Wand2, Upload, Download, Copy, Check, RefreshCw } from '../Icons';
import type { Translations } from '../../i18n/types';
import type { LineStickerSheetStatus } from '../../hooks/useLineStickerSheetGeneration';
import { RenderProfiler } from '../RenderProfiler';
import {
  LINE_STICKER_SHEET_INDICES,
  type LineStickerSheetIndex,
} from '../../utils/lineStickerSetSchema';
import {
  LineStickerSetOverviewPanel,
  type LineStickerSetOverviewItem,
} from './LineStickerSetOverviewPanel';

export interface LineStickerPhraseSectionProps {
  /** i18n */
  t: Translations;
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  phraseGridList: string[];
  actionDescGridList: string[];
  phraseGridCols: number;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
  isGeneratingPhrases: boolean;
  handleGeneratePhrases: () => void;
  phraseSetFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadPhraseSet: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadPhraseSet: () => void;
  setCurrentSheetIndex: (i: LineStickerSheetIndex) => void;
  onSelectOverviewSheet: (sheetIndex: LineStickerSheetIndex) => void;
  /** Prompt preview */
  previewPrompt: string | null;
  promptCopied: boolean;
  handleGeneratePromptPreview: () => void;
  handleCopyPrompt: () => void;
  /** Generate */
  isGenerating: boolean;
  sourceImage: string | null;
  onGenerate: () => void;
  onGenerateAllSheets: () => void;
  onCancelGeneration: () => void;
  sheetStatuses: LineStickerSheetStatus[];
  sheetOverviewItems: LineStickerSetOverviewItem[];
  hasFailedSheets: boolean;
  onRetryFailedSheets: () => void;
  onRetrySheet: (sheetIndex: LineStickerSheetIndex) => void;
}

interface LineStickerPhraseGridEditorProps {
  t: Translations;
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  phraseGridList: string[];
  actionDescGridList: string[];
  phraseGridCols: number;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
}

interface LineStickerPhraseCellProps {
  t: Translations;
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  index: number;
  phrase: string;
  actionDesc: string;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
}

const LineStickerPhraseCell: React.FC<LineStickerPhraseCellProps> = React.memo(({
  t,
  stickerSetMode,
  currentSheetIndex,
  index,
  phrase,
  actionDesc,
  updatePhraseAt,
  updateActionDescAt,
}) => (
  <div className="flex flex-col gap-1">
    <input
      type="text"
      value={phrase}
      onChange={(e) => updatePhraseAt(index, e.target.value)}
      placeholder={`${index + 1}`}
      className="w-full min-w-0 p-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none bg-white"
      aria-label={
        stickerSetMode
          ? `Sheet ${currentSheetIndex + 1} cell ${index + 1} phrase`
          : `Cell ${index + 1} phrase`
      }
    />
    <textarea
      rows={2}
      value={actionDesc}
      onChange={(e) => updateActionDescAt(index, e.target.value)}
      placeholder={t.lineStickerActionDescPlaceholder}
      className="w-full min-w-0 min-h-[3.5rem] p-1.5 border border-slate-100 rounded text-xs text-slate-500 focus:ring-2 focus:ring-green-500 outline-none bg-slate-50 resize-y"
      aria-label={
        stickerSetMode
          ? `Sheet ${currentSheetIndex + 1} cell ${index + 1} action`
          : `Cell ${index + 1} action`
      }
    />
  </div>
));

LineStickerPhraseCell.displayName = 'LineStickerPhraseCell';

const LineStickerPhraseGridEditor: React.FC<LineStickerPhraseGridEditorProps> = React.memo(({
  t,
  stickerSetMode,
  currentSheetIndex,
  phraseGridList,
  actionDescGridList,
  phraseGridCols,
  updatePhraseAt,
  updateActionDescAt,
}) => (
  <RenderProfiler id="LineStickerPhraseGrid">
    <div
      className="gap-1.5 w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${phraseGridCols}, minmax(0, 1fr))`,
        gridAutoRows: 'auto',
      }}
    >
      {phraseGridList.map((phrase, index) => (
        <LineStickerPhraseCell
          key={stickerSetMode ? `s${currentSheetIndex}-${index}` : index}
          t={t}
          stickerSetMode={stickerSetMode}
          currentSheetIndex={currentSheetIndex}
          index={index}
          phrase={phrase}
          actionDesc={actionDescGridList[index] ?? ''}
          updatePhraseAt={updatePhraseAt}
          updateActionDescAt={updateActionDescAt}
        />
      ))}
    </div>
  </RenderProfiler>
));

LineStickerPhraseGridEditor.displayName = 'LineStickerPhraseGridEditor';

export const LineStickerPhraseSection: React.FC<LineStickerPhraseSectionProps> = React.memo(({
  t,
  stickerSetMode,
  currentSheetIndex,
  phraseGridList,
  actionDescGridList,
  phraseGridCols,
  updatePhraseAt,
  updateActionDescAt,
  isGeneratingPhrases,
  handleGeneratePhrases,
  phraseSetFileInputRef,
  handleUploadPhraseSet,
  handleDownloadPhraseSet,
  setCurrentSheetIndex,
  onSelectOverviewSheet,
  previewPrompt,
  promptCopied,
  handleGeneratePromptPreview,
  handleCopyPrompt,
  isGenerating,
  sourceImage,
  onGenerate,
  onGenerateAllSheets,
  onCancelGeneration,
  sheetStatuses,
  sheetOverviewItems,
  hasFailedSheets,
  onRetryFailedSheets,
  onRetrySheet,
}) => (
  <>
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <label className="text-sm font-semibold text-slate-800">
            {stickerSetMode ? t.lineStickerPhraseListSet : t.lineStickerPhraseListSingle}
          </label>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {stickerSetMode ? t.lineStickerPhraseGenHint48 : t.lineStickerPhraseGenHint}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed border-l-2 border-green-200 pl-2">
            {t.lineStickerPhraseActionHint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2 shrink-0">
          <button
            type="button"
            onClick={handleGeneratePhrases}
            disabled={isGeneratingPhrases}
            title={stickerSetMode ? t.lineStickerPhraseGenHint48 : t.lineStickerPhraseGenHint}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-white border border-green-200 rounded-lg px-3 py-2 shadow-sm hover:bg-green-50 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 min-h-[40px]"
          >
            {isGeneratingPhrases ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
            )}
            {stickerSetMode ? t.lineStickerGeneratePhrases48 : t.lineStickerGeneratePhrases}
          </button>
          <input
            ref={phraseSetFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleUploadPhraseSet}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => phraseSetFileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 min-h-[40px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            {t.lineStickerPhraseSetUpload}
          </button>
          <button
            type="button"
            onClick={handleDownloadPhraseSet}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 min-h-[40px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            {t.lineStickerPhraseSetDownload}
          </button>
        </div>
      </div>
      {stickerSetMode && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t.lineStickerSheetSelector}>
          {LINE_STICKER_SHEET_INDICES.map((i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={currentSheetIndex === i}
              onClick={() => setCurrentSheetIndex(i)}
              className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                currentSheetIndex === i
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.lineStickerSheetN.replace('{n}', String(i + 1))}
            </button>
          ))}
        </div>
      )}
      <LineStickerPhraseGridEditor
        t={t}
        stickerSetMode={stickerSetMode}
        currentSheetIndex={currentSheetIndex}
        phraseGridList={phraseGridList}
        actionDescGridList={actionDescGridList}
        phraseGridCols={phraseGridCols}
        updatePhraseAt={updatePhraseAt}
        updateActionDescAt={updateActionDescAt}
      />
    </div>

    <div className="space-y-3 p-4 bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-xl border border-slate-200 shadow-inner">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerPromptPreviewTitle}</h3>
        <button
          type="button"
          onClick={handleGeneratePromptPreview}
          className="text-xs px-4 py-2 min-h-[40px] bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          {t.lineStickerGeneratePrompt}
        </button>
      </div>
      {previewPrompt ? (
        <>
          <pre
            className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-white border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto"
            role="region"
            aria-label={t.lineStickerPromptPreviewTitle}
          >
            {previewPrompt}
          </pre>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-slate-500">{t.lineStickerPromptConfirmHint}</p>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1.5"
            >
              {promptCopied ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {promptCopied ? t.lineStickerCopyPromptDone : t.lineStickerCopyPrompt}
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">{t.lineStickerPromptEmptyHint}</p>
      )}
    </div>

    {stickerSetMode && (
      <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerSetOverviewTitle}</h3>
            <p className="mt-1 text-xs text-slate-500">{t.lineStickerSetOverviewHint}</p>
          </div>
          {hasFailedSheets ? (
            <button
              type="button"
              onClick={onRetryFailedSheets}
              disabled={isGenerating}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t.lineStickerRetryFailed}
            </button>
          ) : null}
        </div>

        <LineStickerSetOverviewPanel
          t={t}
          items={sheetOverviewItems}
          currentSheetIndex={currentSheetIndex}
          onSelectSheet={onSelectOverviewSheet}
          onRetrySheet={onRetrySheet}
          isGenerating={isGenerating}
        />
      </div>
    )}

    <div className="flex flex-col sm:flex-row gap-3 pt-2">
      <button
        type="button"
        onClick={stickerSetMode ? onGenerateAllSheets : onGenerate}
        disabled={isGenerating || !sourceImage || !previewPrompt}
        title={
          !sourceImage
            ? undefined
            : !previewPrompt
              ? t.lineStickerPromptEmptyHint
              : undefined
        }
        className="flex-1 min-h-[52px] py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/25 hover:shadow-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:shadow-none disabled:hover:from-green-500 disabled:hover:to-emerald-600 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
      >
        {isGenerating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Wand2 className="w-5 h-5" />
        )}
        {stickerSetMode ? t.lineStickerGenerateAll : t.lineStickerGenerate}
      </button>
      {isGenerating ? (
        <button
          type="button"
          onClick={onCancelGeneration}
          className="sm:w-auto min-h-[52px] py-4 px-5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          {t.cancel}
        </button>
      ) : null}
    </div>
  </>
));

LineStickerPhraseSection.displayName = 'LineStickerPhraseSection';
