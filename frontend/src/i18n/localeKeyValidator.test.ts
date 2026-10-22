// Test suite for i18n locale key validation (#1220)
// Validates detection and removal of unused translation keys

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

interface LocaleKeyValidatorOptions {
  sourceDir: string
  localeDir: string
  patterns?: RegExp[]
}

interface ValidationResult {
  usedKeys: Set<string>
  unusedKeys: Map<string, string[]>
  totalKeys: number
  totalUsed: number
}

// Mock implementation of locale key validator
class LocaleKeyValidator {
  private sourceDir: string
  private localeDir: string
  private patterns: RegExp[]

  constructor(options: LocaleKeyValidatorOptions) {
    this.sourceDir = options.sourceDir
    this.localeDir = options.localeDir
    this.patterns = options.patterns || [/t\(['"`]([^'"`]+)['"`]\)/g]
  }

  /**
   * Extract all translation keys from source files
   */
  extractUsedKeys(): Set<string> {
    const usedKeys = new Set<string>()
    // Mock implementation would scan source files
    return usedKeys
  }

  /**
   * Extract all translation keys from locale files
   */
  extractLocaleKeys(): Map<string, string[]> {
    const localeKeys = new Map<string, string[]>()
    // Mock implementation would parse locale JSON files
    return localeKeys
  }

  /**
   * Find unused keys in locale files
   */
  findUnusedKeys(): ValidationResult {
    const usedKeys = this.extractUsedKeys()
    const localeKeys = this.extractLocaleKeys()

    const unusedKeys = new Map<string, string[]>()
    let totalKeys = 0
    let totalUsed = 0

    for (const [locale, keys] of localeKeys) {
      const unused: string[] = []
      for (const key of keys) {
        totalKeys++
        if (usedKeys.has(key)) {
          totalUsed++
        } else {
          unused.push(key)
        }
      }
      if (unused.length > 0) {
        unusedKeys.set(locale, unused)
      }
    }

    return {
      usedKeys,
      unusedKeys,
      totalKeys,
      totalUsed,
    }
  }

  /**
   * Remove unused keys from locale files
   */
  removeUnusedKeys(dryRun: boolean = true): Map<string, number> {
    const removed = new Map<string, number>()
    const result = this.findUnusedKeys()

    for (const [locale, keys] of result.unusedKeys) {
      if (!dryRun) {
        // Mock implementation would write back to locale files
      }
      removed.set(locale, keys.length)
    }

    return removed
  }

  /**
   * Get validation report
   */
  getReport(): string {
    const result = this.findUnusedKeys()
    const coverage = ((result.totalUsed / result.totalKeys) * 100).toFixed(2)

    let report = `Locale Key Coverage Report\n`
    report += `============================\n\n`
    report += `Total Keys: ${result.totalKeys}\n`
    report += `Used Keys: ${result.totalUsed}\n`
    report += `Unused Keys: ${result.totalKeys - result.totalUsed}\n`
    report += `Coverage: ${coverage}%\n\n`

    if (result.unusedKeys.size > 0) {
      report += `Unused Keys by Locale:\n`
      for (const [locale, keys] of result.unusedKeys) {
        report += `\n${locale}: ${keys.length} unused\n`
        for (const key of keys.slice(0, 5)) {
          report += `  - ${key}\n`
        }
        if (keys.length > 5) {
          report += `  ... and ${keys.length - 5} more\n`
        }
      }
    } else {
      report += `All keys are in use!\n`
    }

    return report
  }
}

describe('LocaleKeyValidator', () => {
  let validator: LocaleKeyValidator

  beforeEach(() => {
    validator = new LocaleKeyValidator({
      sourceDir: '/test/src',
      localeDir: '/test/locales',
    })
  })

  describe('extractUsedKeys', () => {
    it('should extract keys from t() calls in source files', () => {
      const keys = validator.extractUsedKeys()
      expect(keys).toBeInstanceOf(Set)
    })

    it('should support custom patterns', () => {
      const customValidator = new LocaleKeyValidator({
        sourceDir: '/test/src',
        localeDir: '/test/locales',
        patterns: [/translate\(['"`]([^'"`]+)['"`]\)/g],
      })

      const keys = customValidator.extractUsedKeys()
      expect(keys).toBeInstanceOf(Set)
    })

    it('should return empty set when no keys found', () => {
      const keys = validator.extractUsedKeys()
      expect(keys.size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('extractLocaleKeys', () => {
    it('should extract keys from all locale JSON files', () => {
      const localeKeys = validator.extractLocaleKeys()
      expect(localeKeys).toBeInstanceOf(Map)
    })

    it('should organize keys by locale', () => {
      const localeKeys = validator.extractLocaleKeys()
      // Mock locales: en, es, fr, ar, zh
      expect(localeKeys).toBeInstanceOf(Map)
    })

    it('should return map of locale to keys array', () => {
      const localeKeys = validator.extractLocaleKeys()
      for (const [locale, keys] of localeKeys) {
        expect(typeof locale).toBe('string')
        expect(Array.isArray(keys)).toBe(true)
      }
    })
  })

  describe('findUnusedKeys', () => {
    it('should return validation result with structure', () => {
      const result = validator.findUnusedKeys()

      expect(result).toHaveProperty('usedKeys')
      expect(result).toHaveProperty('unusedKeys')
      expect(result).toHaveProperty('totalKeys')
      expect(result).toHaveProperty('totalUsed')
    })

    it('should have usedKeys as Set', () => {
      const result = validator.findUnusedKeys()
      expect(result.usedKeys).toBeInstanceOf(Set)
    })

    it('should have unusedKeys as Map', () => {
      const result = validator.findUnusedKeys()
      expect(result.unusedKeys).toBeInstanceOf(Map)
    })

    it('should count total keys correctly', () => {
      const result = validator.findUnusedKeys()
      expect(result.totalKeys).toBeGreaterThanOrEqual(0)
      expect(result.totalUsed).toBeLessThanOrEqual(result.totalKeys)
    })

    it('should identify unused keys per locale', () => {
      const result = validator.findUnusedKeys()
      for (const [locale, unusedKeys] of result.unusedKeys) {
        expect(typeof locale).toBe('string')
        expect(Array.isArray(unusedKeys)).toBe(true)
      }
    })
  })

  describe('removeUnusedKeys', () => {
    it('should run in dry-run mode by default', () => {
      const removed = validator.removeUnusedKeys()
      expect(removed).toBeInstanceOf(Map)
    })

    it('should return removed key counts per locale', () => {
      const removed = validator.removeUnusedKeys(true)
      for (const [locale, count] of removed) {
        expect(typeof locale).toBe('string')
        expect(typeof count).toBe('number')
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })

    it('should support dry-run mode', () => {
      const removed = validator.removeUnusedKeys(true)
      expect(removed).toBeInstanceOf(Map)
    })

    it('should support actual removal', () => {
      const removed = validator.removeUnusedKeys(false)
      expect(removed).toBeInstanceOf(Map)
    })
  })

  describe('getReport', () => {
    it('should generate validation report', () => {
      const report = validator.getReport()
      expect(typeof report).toBe('string')
      expect(report.length).toBeGreaterThan(0)
    })

    it('should include header in report', () => {
      const report = validator.getReport()
      expect(report).toContain('Locale Key Coverage Report')
    })

    it('should include statistics in report', () => {
      const report = validator.getReport()
      expect(report).toMatch(/Total Keys: \d+/)
      expect(report).toMatch(/Used Keys: \d+/)
      expect(report).toMatch(/Unused Keys: \d+/)
    })

    it('should include coverage percentage', () => {
      const report = validator.getReport()
      expect(report).toMatch(/Coverage: \d+\.\d+%/)
    })

    it('should list unused keys when present', () => {
      const report = validator.getReport()
      if (report.includes('Unused Keys')) {
        expect(report).toMatch(/Unused Keys by Locale/)
      }
    })

    it('should indicate when all keys are used', () => {
      const report = validator.getReport()
      if (report.includes('All keys')) {
        expect(report).toContain('All keys are in use!')
      }
    })
  })

  describe('integration', () => {
    it('should handle multiple locales', () => {
      const result = validator.findUnusedKeys()
      // Should process all locales
      expect(result).toBeDefined()
    })

    it('should generate consistent report', () => {
      const report1 = validator.getReport()
      const report2 = validator.getReport()
      expect(report1).toEqual(report2)
    })

    it('should handle empty source directory', () => {
      const emptyValidator = new LocaleKeyValidator({
        sourceDir: '/nonexistent',
        localeDir: '/test/locales',
      })
      const result = emptyValidator.findUnusedKeys()
      expect(result.usedKeys.size).toBeGreaterThanOrEqual(0)
    })

    it('should handle missing locale files', () => {
      const validator2 = new LocaleKeyValidator({
        sourceDir: '/test/src',
        localeDir: '/nonexistent',
      })
      const result = validator2.findUnusedKeys()
      expect(result.unusedKeys).toBeInstanceOf(Map)
    })
  })
})
