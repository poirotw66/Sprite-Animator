import { useContext } from 'react';
import { LanguageContext, type LanguageContextType } from './languageContext';

/** Access the current UI language and translations. */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
