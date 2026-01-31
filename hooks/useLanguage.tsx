import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, Translations, getTranslation } from '../i18n';

const LANGUAGE_STORAGE_KEY = 'sprite_animator_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Extended Navigator interface for legacy browser support
 */
interface NavigatorWithUserLanguage extends Navigator {
  userLanguage?: string;
}

/**
 * Detects the user's preferred language from browser settings
 */
const detectBrowserLanguage = (): Language => {
  const nav = navigator as NavigatorWithUserLanguage;
  const browserLang = nav.language || nav.userLanguage || 'en';
  
  // Check for Chinese variants
  if (browserLang.startsWith('zh')) {
    return 'zh-TW';
  }
  
  // Default to English for all other languages
  return 'en';
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get from localStorage first
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'zh-TW' || stored === 'en') {
      return stored;
    }
    // Fall back to browser detection
    return detectBrowserLanguage();
  });

  const [translations, setTranslations] = useState<Translations>(() => getTranslation(language));

  // Update translations when language changes
  useEffect(() => {
    setTranslations(getTranslation(language));
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to access the language context
 * @returns LanguageContextType with language, setLanguage, and translations (t)
 * 
 * @example
 * ```tsx
 * const { t, language, setLanguage } = useLanguage();
 * 
 * return (
 *   <div>
 *     <h1>{t.appTitle}</h1>
 *     <button onClick={() => setLanguage('en')}>English</button>
 *   </div>
 * );
 * ```
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
