import React from 'react';
import { Check, Download, ImageIcon, Loader2, Wand2 } from '../Icons';
import {
  STYLE_PRESETS,
  STYLE_PRESET_ORDER,
} from '../../utils/lineStickerPresets';
import { useLanguage } from '../../hooks/useLanguage';

export interface ComicCharacterSheetStepProps {
  styleKey: string;
  characterSheetImage: string | null;
  isGenerating: boolean;
  status?: string | null;
  error?: string | null;
  onStyleKeyChange: (styleKey: string) => void;
  onGenerate: () => void;
  onDownload?: () => void;
  className?: string;
}

function resolveStyleMeta(styleKey: string) {
  const fallbackKey = STYLE_PRESET_ORDER[1] ?? STYLE_PRESET_ORDER[0];
  const effectiveKey = (styleKey in STYLE_PRESETS ? styleKey : fallbackKey) as keyof typeof STYLE_PRESETS;
  return STYLE_PRESETS[effectiveKey];
}

export const ComicCharacterSheetStep: React.FC<ComicCharacterSheetStepProps> = React.memo(({
  styleKey,
  characterSheetImage,
  isGenerating,
  status = null,
  error = null,
  onStyleKeyChange,
  onGenerate,
  onDownload,
  className = '',
}) => {
  const { t } = useLanguage();
  const styleMeta = resolveStyleMeta(styleKey);

  return (
    <div className={`grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] ${className}`.trim()}>
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Wand2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              {t.comicStepSheet}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
              {t.comicStepSheet}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t.comicSheetDescription}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t.comicStyleLabel}
              </label>
              <select
                value={styleKey}
                onChange={(event) => onStyleKeyChange(event.target.value)}
                className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
              >
                {STYLE_PRESET_ORDER.map((presetKey) => (
                  <option key={presetKey} value={presetKey}>
                    {STYLE_PRESETS[presetKey].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Check className="h-4 w-4 text-indigo-600" aria-hidden />
                {t.comicSelectedStyleDetails}
              </div>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t.comicStyleDetailLabel}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">{styleMeta.label}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t.comicStyleDetailType}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                    {styleMeta.styleType}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t.comicStyleDetailMethod}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                    {styleMeta.drawingMethod}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t.comicSheetPreviewTitle}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t.comicSheetPreviewDescription}
                </p>
              </div>
              {characterSheetImage ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  {t.comicSheetReady}
                </span>
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white">
              {characterSheetImage ? (
                <img
                  src={characterSheetImage}
                  alt={t.comicSheetPreviewAlt}
                  className="aspect-square w-full object-contain bg-white"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/60 p-6 text-center">
                  <div>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                      <ImageIcon className="h-6 w-6" aria-hidden />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-700">
                      {t.comicSheetEmptyTitle}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {t.comicSheetEmptyDescription}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {status ? (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-700">
                {status}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                  isGenerating
                    ? 'cursor-not-allowed bg-slate-300'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700'
                }`}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
                {isGenerating
                  ? t.comicGeneratingSheet
                  : characterSheetImage
                    ? t.comicRegenerateSheet
                    : t.comicGenerateSheet}
              </button>

              <button
                type="button"
                onClick={onDownload}
                disabled={!characterSheetImage || !onDownload}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                {t.comicDownloadSheet}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ComicCharacterSheetStep.displayName = 'ComicCharacterSheetStep';
