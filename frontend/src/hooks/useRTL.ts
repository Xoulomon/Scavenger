import { useTranslation } from 'react-i18next'
import { RTL_LANGUAGES } from '../i18n/config'

/**
 * Returns whether the currently active language is RTL.
 * Also returns the CSS `dir` value ('rtl' | 'ltr') for convenience.
 */
export function useRTL(): { isRTL: boolean; dir: 'rtl' | 'ltr' } {
  const { i18n } = useTranslation()
  const isRTL = RTL_LANGUAGES.has(i18n.language)
  return { isRTL, dir: isRTL ? 'rtl' : 'ltr' }
}
