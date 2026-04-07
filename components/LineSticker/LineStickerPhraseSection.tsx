import React from 'react';
import { Loader2, Wand2, Upload, Download, Copy, Check, RefreshCw, AlertTriangle } from '../Icons';
import type { Translations } from '../../i18n/types';
import type { LineStickerSheetStatus } from '../../hooks/useLineStickerSheetGeneration';

export interface LineStickerPhraseSectionProps {
  /** i18n */
  t: Translations;
  stickerSetMode: boolean;
  currentSheetIndex: 0 | 1 | 2;
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
  setCurrentSheetIndex: (i: 0 | 1 | 2) => void;
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
  hasFailedSheets: boolean;
  onRetryFailedSheets: () => void;
  onRetrySheet: (sheetIndex: 0 | 1 | 2) => void;
}

export const LineStickerPhraseSection: React.FC<LineStickerPhraseSectionProps> = ({
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
  hasFailedSheets,
  onRetryFailedSheets,
  onRetrySheet,
}) => (
  <>
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <label className="text-sm font-medium text-slate-700">{t.lineStickerPhraseListSet}</label>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePhrases}
            disabled={isGeneratingPhrases}
            className="text-xs text-green-600 flex items-center gap-1 font-semibold hover:text-green-700"
          >
            {isGeneratingPhrases ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            {t.lineStickerGeneratePhrases}
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
            className="text-xs text-slate-600 flex items-center gap-1 font-medium hover:text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {t.lineStickerPhraseSetUpload}
          </button>
          <button
            type="button"
            onClick={handleDownloadPhraseSet}
            className="text-xs text-slate-600 flex items-center gap-1 font-medium hover:text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            {t.lineStickerPhraseSetDownload}
          </button>
        </div>
      </div>
      {stickerSetMode && (
        <div className="flex gap-1 mb-2">
          {([0, 1, 2] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentSheetIndex(i)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                currentSheetIndex === i
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
              }`}
            >
              {t.lineStickerSheetN.replace('{n}', String(i + 1))}
            </button>
          ))}
        </div>
      )}
      <div
        className="gap-1.5 w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${phraseGridCols}, minmax(0, 1fr))`,
          gridAutoRows: 'auto',
        }}
      >
        {phraseGridList.map((phrase, index) => (
          <div
            key={stickerSetMode ? `s${currentSheetIndex}-${index}` : index}
            className="flex flex-col gap-1"
          >
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
              value={actionDescGridList[index] ?? ''}
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
        ))}
      </div>
    </div>

    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerPromptPreviewTitle}</h3>
        <button
          type="button"
          onClick={handleGeneratePromptPreview}
          className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
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
          <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerSheetProgressTitle}</h3>
          {hasFailedSheets && (
            <button
              type="button"
              onClick={onRetryFailedSheets}
              disabled={isGenerating}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t.lineStickerRetryFailed}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {sheetStatuses.map((status) => {
            const isFailed = status.stage === 'failed';
            const isCompleted = status.stage === 'completed';
            const isActive = status.stage === 'queued' || status.stage === 'generating' || status.stage === 'processing' || status.stage === 'slicing';
            const progressBarColor = isFailed
              ? 'bg-red-500'
              : isCompleted
                ? 'bg-emerald-500'
                : 'bg-green-500';

            return (
              <div key={status.sheetIndex} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {t.lineStickerSheetN.replace('{n}', String(status.sheetIndex + 1))}
                      </span>
                      {isActive ? <Loader2 className="w-3.5 h-3.5 text-green-600 animate-spin" /> : null}
                      {isCompleted ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                      {isFailed ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : null}
                    </div>
                    <p className={`text-xs mt-1 ${isFailed ? 'text-red-600' : 'text-slate-600'}`}>
                      {status.message || t.lineStickerSheetN.replace('{n}', String(status.sheetIndex + 1))}
                    </p>
                    {status.error ? (
                      <p className="text-xs mt-1 text-red-600 break-words">{status.error}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-slate-500">{status.progress}%</span>
                    {isFailed ? (
                      <button
                        type="button"
                        onClick={() => onRetrySheet(status.sheetIndex)}
                        disabled={isGenerating}
                        className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t.lineStickerRetrySheetN.replace('{n}', String(status.sheetIndex + 1))}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${progressBarColor}`}
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={stickerSetMode ? onGenerateAllSheets : onGenerate}
        disabled={isGenerating || !sourceImage || !previewPrompt}
        className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
          className="sm:w-auto py-4 px-5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
        >
          {t.cancel}
        </button>
      ) : null}
    </div>
  </>
);
