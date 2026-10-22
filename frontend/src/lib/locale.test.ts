import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getLocaleConfig,
  detectLocale,
  setLocaleOverride,
  clearLocaleOverride,
  formatCurrency,
  formatNumber,
  formatWeight,
  formatDistance,
  formatDate,
} from './locale'

describe('getLocaleConfig', () => {
  it('returns USD/lb/mi for en-US', () => {
    const cfg = getLocaleConfig('en-US')
    expect(cfg.currency).toBe('USD')
    expect(cfg.weightUnit).toBe('lb')
    expect(cfg.distanceUnit).toBe('mi')
  })

  it('returns EUR/kg/km for es', () => {
    const cfg = getLocaleConfig('es')
    expect(cfg.currency).toBe('EUR')
    expect(cfg.weightUnit).toBe('kg')
    expect(cfg.distanceUnit).toBe('km')
  })

  it('falls back to language prefix for es-MX → es when es-MX exists', () => {
    const cfg = getLocaleConfig('es-MX')
    expect(cfg.currency).toBe('MXN')
  })

  it('falls back to default config for unknown locale', () => {
    const cfg = getLocaleConfig('xx-UNKNOWN')
    expect(cfg.currency).toBe('USD')
  })

  it('returns CNY for zh', () => {
    expect(getLocaleConfig('zh').currency).toBe('CNY')
  })

  it('returns SAR for ar', () => {
    expect(getLocaleConfig('ar').currency).toBe('SAR')
  })
})

describe('locale override', () => {
  beforeEach(() => clearLocaleOverride())
  afterEach(() => clearLocaleOverride())

  it('setLocaleOverride persists to localStorage', () => {
    setLocaleOverride('fr')
    expect(localStorage.getItem('scavngr_locale_override')).toBe('fr')
  })

  it('detectLocale returns override when set', () => {
    setLocaleOverride('de')
    expect(detectLocale()).toBe('de')
  })

  it('clearLocaleOverride removes the stored value', () => {
    setLocaleOverride('zh')
    clearLocaleOverride()
    expect(localStorage.getItem('scavngr_locale_override')).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    const result = formatCurrency(1234.56, 'en-US', 'USD')
    expect(result).toContain('1,234.56')
  })

  it('formats EUR correctly for fr locale', () => {
    const result = formatCurrency(100, 'fr', 'EUR')
    expect(result).toContain('100')
    expect(result).toContain('€')
  })

  it('accepts explicit currency override', () => {
    const result = formatCurrency(50, 'en-US', 'GBP')
    expect(result).toContain('£')
  })

  it('falls back gracefully for invalid currency', () => {
    const result = formatCurrency(99.99, 'en-US', 'INVALID')
    expect(result).toContain('99.99')
  })
})

describe('formatNumber', () => {
  it('formats with 2 decimal places by default', () => {
    const result = formatNumber(1234.5, 'en-US')
    expect(result).toBe('1,234.50')
  })

  it('respects custom fractionDigits', () => {
    const result = formatNumber(1.5, 'en-US', 0)
    expect(result).toBe('2')
  })
})

describe('formatWeight', () => {
  it('converts kg to lb for en-US locale', () => {
    const result = formatWeight(1, 'en-US')
    expect(result).toContain('lb')
    expect(result).toContain('2.2')
  })

  it('keeps kg for metric locales', () => {
    const result = formatWeight(10, 'fr')
    expect(result).toContain('kg')
    expect(result).toMatch(/10[.,]0/)
  })
})

describe('formatDistance', () => {
  it('converts km to mi for en-US locale', () => {
    const result = formatDistance(1, 'en-US')
    expect(result).toContain('mi')
    expect(result).toContain('0.6')
  })

  it('keeps km for metric locales', () => {
    const result = formatDistance(100, 'fr')
    expect(result).toContain('km')
    expect(result).toMatch(/100[.,]0/)
  })
})

describe('formatDate', () => {
  it('returns a non-empty formatted date string', () => {
    const result = formatDate(new Date('2024-06-15'), 'en-US')
    expect(result).toContain('2024')
  })

  it('handles timestamp input', () => {
    const result = formatDate(0, 'en-US')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
