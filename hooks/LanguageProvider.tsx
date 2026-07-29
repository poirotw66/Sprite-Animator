import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { getTranslation, type Language } from '../i18n';
import { LanguageContext, type LanguageContextType } from './languageContext';

const LANGUAGE_STORAGE_KEY = 'sprite_animator_language';

interface NavigatorWithUserLanguage extends Navigator {
  userLanguage?: string;
}

function detectBrowserLanguage(): Language {
  const nav = navigator as NavigatorWithUserLanguage;
  const browserLang = nav.language || nav.userLanguage || 'en';
  return browserLang.startsWith('zh') ? 'zh-TW' : 'en';
}

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'zh-TW' || stored === 'en' ? stored : detectBrowserLanguage();
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      t: getTranslation(language),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
