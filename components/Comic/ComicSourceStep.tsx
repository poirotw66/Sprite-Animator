import React from 'react';
import { ImageIcon, Pencil } from '../Icons';
import { ImageUpload } from '../ImageUpload';

export type ComicSourceMode = 'upload' | 'concept';

export interface ComicSourceStepProps {
  sourceMode: ComicSourceMode;
  referenceImage: string | null;
  characterConcept: string;
  onSourceModeChange: (mode: ComicSourceMode) => void;
  onCharacterConceptChange: (value: string) => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
  className?: string;
}

// TODO(Task 11): Replace temporary English copy with comic i18n keys.
export const ComicSourceStep: React.FC<ComicSourceStepProps> = React.memo(({
  sourceMode,
  referenceImage,
  characterConcept,
  onSourceModeChange,
  onCharacterConceptChange,
  onImageUpload,
  onDrop,
  className = '',
}) => (
  <div className={`space-y-5 ${className}`.trim()}>
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Step 1
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            Choose your character source
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Start from an uploaded reference image or write a concept for the comic
            lead character. The parent page will decide how to persist and validate
            this data.
          </p>
        </div>

        <div className="inline-flex rounded-2xl bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => onSourceModeChange('upload')}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              sourceMode === 'upload'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ImageIcon className="h-4 w-4" aria-hidden />
            Upload image
          </button>
          <button
            type="button"
            onClick={() => onSourceModeChange('concept')}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              sourceMode === 'concept'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Write concept
          </button>
        </div>
      </div>
    </div>

    {sourceMode === 'upload' ? (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ImageUpload
          sourceImage={referenceImage}
          onImageUpload={onImageUpload}
          onDrop={onDrop}
        />

        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Reference image tips</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <li>- Use a clear single-character image if possible.</li>
            <li>- Full body or at least waist-up works best for pose consistency.</li>
            <li>- Strong silhouettes and readable costume details improve the sheet.</li>
          </ul>
          <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white/80 p-3 text-xs leading-relaxed text-slate-500">
            Optional: keep a short concept in parent state too if you want extra prompt
            guidance later.
          </div>
        </div>
      </div>
    ) : (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Pencil className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">Describe the character</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Cover appearance, outfit, mood, and any recurring prop the comic should
              preserve.
            </p>
          </div>
        </div>

        <textarea
          value={characterConcept}
          onChange={(event) => onCharacterConceptChange(event.target.value)}
          placeholder="Example: A sleepy office fox in an oversized indigo hoodie, expressive ears, tiny coffee mug, dry sense of humor."
          className="mt-5 min-h-[220px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-700 outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            'Appearance',
            'Personality',
            'Signature items',
          ].map((pill) => (
            <div
              key={pill}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"
            >
              {pill}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
));

ComicSourceStep.displayName = 'ComicSourceStep';
