import React from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw } from '../Icons';
import type { LineStickerSheetStage } from '../../hooks/useLineStickerSheetGeneration';
import type { Translations } from '../../i18n/types';
import type { LineStickerSheetIndex } from '../../utils/lineStickerSetSchema';

export interface LineStickerSetOverviewItem {
  sheetIndex: LineStickerSheetIndex;
  promptSummary: string;
  hasPromptContent: boolean;
  progress: number;
  stage: LineStickerSheetStage;
  message: string;
  error: string | null;
}

export interface LineStickerSetOverviewPanelProps {
  t: Translations;
  items: LineStickerSetOverviewItem[];
  currentSheetIndex: LineStickerSheetIndex;
  onSelectSheet: (sheetIndex: LineStickerSheetIndex) => void;
  onRetrySheet: (sheetIndex: LineStickerSheetIndex) => void;
  isGenerating: boolean;
  compact?: boolean;
}

function isActiveStage(stage: LineStickerSheetStage): boolean {
  return stage === 'queued' || stage === 'generating' || stage === 'processing' || stage === 'slicing';
}

export const LineStickerSetOverviewPanel: React.FC<LineStickerSetOverviewPanelProps> = React.memo(({
  t,
  items,
  currentSheetIndex,
  onSelectSheet,
  onRetrySheet,
  isGenerating,
  compact = false,
}) => (
  <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 gap-3 xl:grid-cols-3'}>
    {items.map((item) => {
      const isCurrent = item.sheetIndex === currentSheetIndex;
      const isFailed = item.stage === 'failed';
      const isCompleted = item.stage === 'completed';
      const isActive = isActiveStage(item.stage);
      const progressBarColor = isFailed
        ? 'bg-red-500'
        : isCompleted
          ? 'bg-emerald-500'
          : 'bg-green-500';
      const statusText = item.message || (item.stage === 'idle' ? t.lineStickerSheetIdle : '');

      return (
        <button
          key={item.sheetIndex}
          type="button"
          onClick={() => onSelectSheet(item.sheetIndex)}
          className={`rounded-xl border p-3 text-left transition-all ${
            isCurrent
              ? 'border-green-300 bg-green-50/70 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {t.lineStickerSheetN.replace('{n}', String(item.sheetIndex + 1))}
                </span>
                {isActive ? <Loader2 className="w-3.5 h-3.5 text-green-600 animate-spin" /> : null}
                {isCompleted ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                {isFailed ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : null}
              </div>
              <p className={`mt-1 text-xs ${isFailed ? 'text-red-600' : 'text-slate-500'}`}>
                {statusText}
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500">{item.progress}%</span>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t.lineStickerPromptSummaryLabel}
            </p>
            <p className={`mt-1 text-xs leading-5 ${item.hasPromptContent ? 'text-slate-700' : 'text-slate-400 italic'} ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>
              {item.promptSummary}
            </p>
          </div>

          {item.error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              <span className="font-semibold">{t.lineStickerErrorReasonLabel}</span>
              <span className="ml-1 break-words">{item.error}</span>
            </div>
          ) : null}

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${progressBarColor}`}
              style={{ width: `${item.progress}%` }}
            />
          </div>

          {isFailed ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetrySheet(item.sheetIndex);
                }}
                disabled={isGenerating}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t.lineStickerRetrySheetN.replace('{n}', String(item.sheetIndex + 1))}
              </button>
            </div>
          ) : null}
        </button>
      );
    })}
  </div>
));

LineStickerSetOverviewPanel.displayName = 'LineStickerSetOverviewPanel';