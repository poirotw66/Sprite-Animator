import React from 'react';
import { useLanguage } from '../../hooks/useLanguage';

export type ComicWizardStepValue = 1 | 2 | 3 | 4;

export interface ComicWizardStepsProps {
  currentStep: ComicWizardStepValue;
  onStepChange?: (step: ComicWizardStepValue) => void;
  className?: string;
}

interface WizardStepDefinition {
  step: ComicWizardStepValue;
  label: string;
  helper: string;
}

export const ComicWizardSteps: React.FC<ComicWizardStepsProps> = React.memo(({
  currentStep,
  onStepChange,
  className = '',
}) => {
  const { t } = useLanguage();
  const steps: WizardStepDefinition[] = [
    { step: 1, label: t.comicStepSource, helper: t.comicStepSourceHelper },
    { step: 2, label: t.comicStepSheet, helper: t.comicStepSheetHelper },
    { step: 3, label: t.comicStepStoryboard, helper: t.comicStepStoryboardHelper },
    { step: 4, label: t.comicStepGenerate, helper: t.comicStepGenerateHelper },
  ];

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            {t.comicWizardEyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {t.comicWizardTitle}
          </h2>
        </div>
        <div className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          {t.comicStepCounter.replace('{step}', String(currentStep))}
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {steps.map((item, index) => {
          const isActive = item.step === currentStep;
          const isComplete = item.step < currentStep;
          const canNavigate = Boolean(onStepChange);

          return (
            <li key={item.step} className="relative">
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[calc(50%+1.75rem)] right-[-0.75rem] top-6 hidden h-px bg-gradient-to-r from-indigo-200 via-violet-200 to-transparent md:block"
                />
              ) : null}

              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => onStepChange?.(item.step)}
                className={`relative flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 shadow-sm'
                    : isComplete
                      ? 'border-violet-200 bg-violet-50/60 text-slate-700'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600'
                } ${canNavigate ? 'cursor-pointer hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-sm' : 'cursor-default'}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                    isActive
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm'
                      : isComplete
                        ? 'bg-violet-500 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {item.step}
                </span>

                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {item.helper}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
});

ComicWizardSteps.displayName = 'ComicWizardSteps';
