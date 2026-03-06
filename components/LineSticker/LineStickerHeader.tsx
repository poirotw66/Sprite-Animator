import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Image } from '../Icons';
import { LanguageSwitcher } from '../LanguageSwitcher';

export interface LineStickerHeaderProps {
  title: string;
  hasCustomKey: boolean;
  onOpenSettings: () => void;
}

export const LineStickerHeader: React.FC<LineStickerHeaderProps> = ({
  title,
  hasCustomKey,
  onOpenSettings,
}) => (
  <header className="max-w-7xl mx-auto mb-6">
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <div className="bg-green-500 p-1.5 rounded-lg shadow-sm">
            <Image className="w-5 h-5 text-white" />
          </div>
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <button
          onClick={onOpenSettings}
          className={`p-2 rounded-xl transition-all border ${
            hasCustomKey
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-slate-600 bg-white border-slate-200'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  </header>
);
