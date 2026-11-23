import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import zh from './locales/zh.json'
import ar from './locales/ar.json'

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'zh', 'ar'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  zh: { translation: zh },
  ar: { translation: ar }
}

export const RTL_LANGUAGES = new Set(['ar'])

export function getDirection(lang: string): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr'
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    returnNull: false
  })

// Apply RTL direction on language change
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = getDirection(lng)
  document.documentElement.lang = lng
})

export default i18n
