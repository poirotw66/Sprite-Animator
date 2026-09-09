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
      <Globe className="h-4 w-4 text-ink-faint" />
      <select
        value={language}
        onChange={handleChange}
        className="ui-input min-h-[44px] w-auto cursor-pointer py-2"
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
