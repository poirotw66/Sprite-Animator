import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Image } from '../Icons';
import { LanguageSwitcher } from '../LanguageSwitcher';

export interface LineStickerHeaderProps {
  title: string;
  hasCustomKey: boolean;
  onOpenSettings: () => void;
  jumpToResultLabel: string;
  resultSectionId?: string;
}

export const LineStickerHeader: React.FC<LineStickerHeaderProps> = ({
  title,
  hasCustomKey,
  onOpenSettings,
  jumpToResultLabel,
  resultSectionId = 'line-sticker-result',
}) => (
  <header className="max-w-7xl mx-auto mb-6">
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/"
          aria-label="Back to home"
          className="shrink-0 p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 min-w-0">
          <div className="shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 p-1.5 rounded-xl shadow-sm">
            <Image className="w-5 h-5 text-white" />
          </div>
          <span className="truncate">{title}</span>
        </h1>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <a
          href={`#${resultSectionId}`}
          className="text-xs font-semibold text-green-700 hover:text-green-800 px-3 py-2 rounded-xl border border-green-200 bg-green-50/80 hover:bg-green-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 lg:hidden"
        >
          {jumpToResultLabel}
        </a>
        <LanguageSwitcher />
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open API and model settings"
          className={`p-2.5 rounded-xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
            hasCustomKey
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  </header>
);
