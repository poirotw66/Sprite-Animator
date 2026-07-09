import React from 'react';
import { Download, ImageIcon, Loader2, Wand2 } from '../Icons';
import { useLanguage } from '../../hooks/useLanguage';

export interface ComicResultStepProps {
  pageImage: string | null;
  isGenerating: boolean;
  status?: string | null;
  error?: string | null;
  canGenerate?: boolean;
  onGenerate: () => void;
  onDownload: () => void;
  className?: string;
}

export const ComicResultStep: React.FC<ComicResultStepProps> = React.memo(({
  pageImage,
  isGenerating,
  status = null,
  error = null,
  canGenerate = true,
  onGenerate,
  onDownload,
  className = '',
}) => {
  const { t } = useLanguage();

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7 ${className}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            {t.comicStepGenerate}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {t.comicStepGenerate}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {t.comicResultDescription}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              !canGenerate || isGenerating
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700'
            }`}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
            {isGenerating
              ? t.comicGeneratingPage
              : pageImage
                ? t.comicRegeneratePage
                : t.comicGeneratePage}
          </button>

          <button
            type="button"
            onClick={onDownload}
            disabled={!pageImage}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t.comicDownloadPng}
          </button>
        </div>
      </div>

      {status ? (
        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-700">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 shadow-inner">
        {pageImage ? (
          <img
            src={pageImage}
            alt={t.comicPagePreviewAlt}
            className="w-full object-contain bg-white"
          />
        ) : (
          <div className="flex min-h-[420px] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/50 p-8">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600 shadow-sm">
                <ImageIcon className="h-7 w-7" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {t.comicPagePreviewTitle}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {t.comicPagePreviewDescription}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ComicResultStep.displayName = 'ComicResultStep';
