import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ta from './ta.json';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'en',
  lng: 'en',
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
