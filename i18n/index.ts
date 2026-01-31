export type { Language, Translations } from './types';
export { zhTW } from './zh-TW';
export { en } from './en';

import { Language, Translations } from './types';
import { zhTW } from './zh-TW';
import { en } from './en';

export const translations: Record<Language, Translations> = {
  'zh-TW': zhTW,
  'en': en,
};

export const getTranslation = (lang: Language): Translations => {
  return translations[lang] || zhTW;
};

export const supportedLanguages: { code: Language; name: string; nativeName: string }[] = [
  { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '繁體中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
];
