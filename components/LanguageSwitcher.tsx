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
    <div className="flex shrink-0 items-center gap-2">
      <Globe className="h-4 w-4 shrink-0 text-ink-faint" />
      <select
        value={language}
        onChange={handleChange}
        className="min-h-[44px] w-auto max-w-[9.5rem] cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow hover:border-line-strong focus:border-signal focus:ring-2 focus:ring-signal/30 touch-manipulation"
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
