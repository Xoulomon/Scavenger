/**
 * Issue #1299: Unit tests for useRTL hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRTL } from '../useRTL'

const mockI18n = { language: 'en' }

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: mockI18n }),
}))

vi.mock('../i18n/config', () => ({
  RTL_LANGUAGES: new Set(['ar', 'he', 'fa', 'ur']),
}))

describe('useRTL', () => {
  beforeEach(() => {
    mockI18n.language = 'en'
  })

  it('returns isRTL=false and dir="ltr" for English', () => {
    const { result } = renderHook(() => useRTL())
    expect(result.current.isRTL).toBe(false)
    expect(result.current.dir).toBe('ltr')
  })

  it('returns isRTL=true and dir="rtl" for Arabic', () => {
    mockI18n.language = 'ar'
    const { result } = renderHook(() => useRTL())
    expect(result.current.isRTL).toBe(true)
    expect(result.current.dir).toBe('rtl')
  })

  it('returns isRTL=true and dir="rtl" for Hebrew', () => {
    mockI18n.language = 'he'
    const { result } = renderHook(() => useRTL())
    expect(result.current.isRTL).toBe(true)
    expect(result.current.dir).toBe('rtl')
  })

  it('returns isRTL=false for an LTR language like French', () => {
    mockI18n.language = 'fr'
    const { result } = renderHook(() => useRTL())
    expect(result.current.isRTL).toBe(false)
    expect(result.current.dir).toBe('ltr')
  })

  it('returns isRTL=false for unknown language code', () => {
    mockI18n.language = 'xx'
    const { result } = renderHook(() => useRTL())
    expect(result.current.isRTL).toBe(false)
    expect(result.current.dir).toBe('ltr')
  })
})
