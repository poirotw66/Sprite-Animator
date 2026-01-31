import React from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { Language, supportedLanguages } from '../i18n';
import { Globe } from './Icons';

export const LanguageSwitcher: React.FC = React.memo(() => {
  const { language, setLanguage, t } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-slate-500" />
      <select
        value={language}
        onChange={handleChange}
        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
        aria-label={t.language}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
});

LanguageSwitcher.displayName = 'LanguageSwitcher';
