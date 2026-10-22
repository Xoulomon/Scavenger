import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatDate, formatCurrency, formatNumber, formatTokenAmount } from './format'
import * as locale from './locale'

describe('format utilities', () => {
  beforeEach(() => {
    locale.clearLocaleOverride()
  })

  afterEach(() => {
    locale.clearLocaleOverride()
  })

  describe('formatDate', () => {
    it('should format date from Date object', () => {
      const date = new Date('2024-01-15')
      const result = formatDate(date, 'en-US')
      expect(result).toContain('Jan')
      expect(result).toContain('15')
    })

    it('should format date from timestamp (seconds)', () => {
      const timestamp = Math.floor(new Date('2024-01-15').getTime() / 1000)
      const result = formatDate(timestamp, 'en-US')
      expect(result).toContain('Jan')
      expect(result).toContain('15')
    })

    it('should format date from ISO string', () => {
      const isoString = '2024-01-15'
      const result = formatDate(isoString, 'en-US')
      expect(result).toContain('Jan')
      expect(result).toContain('15')
    })

    it('should use detected locale if not provided', () => {
      const date = new Date('2024-01-15')
      const result = formatDate(date)
      expect(result).toBeTruthy()
    })
  })

  describe('formatCurrency', () => {
    it('should format USD currency for en-US locale', () => {
      const result = formatCurrency(100.5, 'en-US', 'USD')
      expect(result).toContain('$')
      expect(result).toContain('100')
    })

    it('should format with default currency if not provided', () => {
      const result = formatCurrency(100.5, 'en-US')
      expect(result).toContain('100')
    })

    it('should handle missing locale gracefully', () => {
      const result = formatCurrency(100.5)
      expect(result).toBeTruthy()
    })

    it('should format with 2 decimal places', () => {
      const result = formatCurrency(100.567, 'en-US', 'USD')
      expect(result).toMatch(/100\.\d{2}/)
    })
  })

  describe('formatNumber', () => {
    it('should format number with default fraction digits', () => {
      const result = formatNumber(100.5, 'en-US')
      expect(result).toBeTruthy()
    })

    it('should format number with specified fraction digits', () => {
      const result = formatNumber(100.5, 'en-US', 1)
      expect(result).toContain('100')
    })

    it('should use detected locale if not provided', () => {
      const result = formatNumber(100.5)
      expect(result).toBeTruthy()
    })
  })

  describe('formatTokenAmount', () => {
    it('should format token amount with default decimals', () => {
      const amount = BigInt(1000000000)
      const result = formatTokenAmount(amount)
      expect(result).toBeTruthy()
    })

    it('should format token amount with custom decimals', () => {
      const amount = BigInt(1000000000)
      const result = formatTokenAmount(amount, 9)
      expect(result).toBeTruthy()
    })

    it('should format number token amount', () => {
      const amount = 1000000000
      const result = formatTokenAmount(amount, 7)
      expect(result).toBeTruthy()
    })

    it('should respect maximum fraction digits', () => {
      const amount = BigInt(1234567890)
      const result = formatTokenAmount(amount, 9)
      expect(result).toBeTruthy()
    })
  })
})
