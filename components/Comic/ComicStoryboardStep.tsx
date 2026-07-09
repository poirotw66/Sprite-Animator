import React from 'react';
import { Grid, Loader2, Wand2 } from '../Icons';
import {
  COMIC_DIALOGUE_MAX_LEN,
  COMIC_PANEL_COUNT,
  type ComicPanel,
} from '../../utils/comicPanelSchema';
import { useLanguage } from '../../hooks/useLanguage';

export interface ComicStoryboardStepProps {
  synopsis: string;
  panels: ComicPanel[];
  isFilling: boolean;
  error?: string | null;
  invalidPanelIndices?: number[];
  onSynopsisChange: (value: string) => void;
  onPanelChange: (index: number, patch: Partial<ComicPanel>) => void;
  onFillFromSynopsis: () => void;
  className?: string;
}

export const ComicStoryboardStep: React.FC<ComicStoryboardStepProps> = React.memo(({
  synopsis,
  panels,
  isFilling,
  error = null,
  invalidPanelIndices = [],
  onSynopsisChange,
  onPanelChange,
  onFillFromSynopsis,
  className = '',
}) => {
  const { t } = useLanguage();
  const panelPositionLabels = [
    t.comicPanelTopLeft,
    t.comicPanelTopRight,
    t.comicPanelBottomLeft,
    t.comicPanelBottomRight,
  ] as const;

  return (
    <div className={`space-y-5 ${className}`.trim()}>
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              {t.comicStepStoryboard}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
              {t.comicStepStoryboard}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t.comicStoryboardDescription}
            </p>
          </div>

          <button
            type="button"
            onClick={onFillFromSynopsis}
            disabled={isFilling || !synopsis.trim()}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              isFilling || !synopsis.trim()
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700'
            }`}
          >
            {isFilling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
            {isFilling ? t.comicFillingStoryboard : t.comicFillStoryboard}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100">
              <Grid className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-semibold text-slate-900" htmlFor="comic-synopsis">
                {t.comicSynopsisLabel}
              </label>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {t.comicSynopsisDescription}
              </p>
            </div>
          </div>

          <textarea
            id="comic-synopsis"
            value={synopsis}
            onChange={(event) => onSynopsisChange(event.target.value)}
            placeholder={t.comicSynopsisPlaceholder}
            className="mt-4 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: COMIC_PANEL_COUNT }, (_, index) => {
          const panel = panels[index] ?? {
            index,
            sceneDescription: '',
            dialogue: '',
            cameraNote: '',
          };
          const isInvalid = invalidPanelIndices.includes(index);

          return (
            <article
              key={index}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                isInvalid ? 'border-red-200 ring-2 ring-red-100' : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                    #{index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    {panelPositionLabels[index]}
                  </h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {t.comicLayoutBadge}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    {t.comicPanelSceneLabel}
                  </label>
                  <textarea
                    value={panel.sceneDescription}
                    onChange={(event) =>
                      onPanelChange(index, { sceneDescription: event.target.value })
                    }
                    placeholder={t.comicPanelScenePlaceholder}
                    className={`min-h-[132px] w-full rounded-2xl px-4 py-3 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 ${
                      isInvalid
                        ? 'border border-red-200 bg-red-50/40'
                        : 'border border-slate-200 bg-slate-50/70'
                    }`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium text-slate-700">
                        {t.comicPanelDialogueLabel}
                      </label>
                      <span className="text-xs text-slate-400">
                        {(panel.dialogue ?? '').length}/{COMIC_DIALOGUE_MAX_LEN}
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={COMIC_DIALOGUE_MAX_LEN}
                      value={panel.dialogue ?? ''}
                      onChange={(event) => onPanelChange(index, { dialogue: event.target.value })}
                      placeholder={t.comicPanelDialogueLabel}
                      className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {t.comicPanelCameraLabel}
                    </label>
                    <input
                      type="text"
                      value={panel.cameraNote ?? ''}
                      onChange={(event) => onPanelChange(index, { cameraNote: event.target.value })}
                      placeholder={t.comicPanelCameraPlaceholder}
                      className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
});

ComicStoryboardStep.displayName = 'ComicStoryboardStep';
