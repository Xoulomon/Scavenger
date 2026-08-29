#!/usr/bin/env node

/**
 * i18n Key Usage Scanner
 *
 * Scans the frontend codebase to identify:
 * - Unused translation keys (defined in locale files but not referenced)
 * - Hardcoded user-facing strings missing from i18n
 * - Drift between locale files
 *
 * Usage: npx ts-node src/scripts/check-i18n-usage.ts
 */

import fs from 'fs'
import path from 'path'
import { globSync } from 'glob'

interface UsageReport {
  unusedKeys: Record<string, string[]>
  hardcodedStrings: string[]
  missingInLocales: Record<string, string[]>
  summary: {
    totalKeys: number
    usedKeys: number
    unusedKeys: number
    hardcodedStrings: number
  }
}

// Get all translation keys from locale files
function getLocaleKeys(localeDir: string): Record<string, Set<string>> {
  const localeKeys: Record<string, Set<string>> = {}
  const localeFiles = fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'))

  for (const file of localeFiles) {
    const locale = path.basename(file, '.json')
    const content = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf-8'))
    localeKeys[locale] = new Set(flattenKeys(content))
  }

  return localeKeys
}

// Flatten nested object keys with dot notation
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) {
      keys.push(...flattenKeys(v, key))
    } else {
      keys.push(key)
    }
  }
  return keys
}

// Scan source files for i18n key references
function scanSourceFiles(srcDir: string): Set<string> {
  const usedKeys = new Set<string>()

  // Pattern to match: t('key.path') or i18n.t('key.path')
  const keyPattern = /(?:t|i18n\.t)\(['"]([^'"]+)['"]\)/g

  const srcFiles = globSync(`${srcDir}/**/*.{ts,tsx}`, { ignore: '**/node_modules/**' })

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    let match
    while ((match = keyPattern.exec(content)) !== null) {
      usedKeys.add(match[1])
    }
  }

  return usedKeys
}

// Detect hardcoded strings (simple heuristic)
function findHardcodedStrings(srcDir: string): string[] {
  const hardcoded: string[] = []
  const commonUIStrings = /['"`](Loading|Error|Success|Cancel|Confirm|Save|Delete|Edit|Close|Submit)[`'"]/.g

  const srcFiles = globSync(`${srcDir}/**/*.{ts,tsx}`, { ignore: '**/node_modules/**' })

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    // Skip test files and i18n config
    if (file.includes('__tests__') || file.includes('i18n')) continue

    let match
    while ((match = commonUIStrings.exec(content)) !== null) {
      const str = match[1]
      if (!hardcoded.includes(str)) {
        hardcoded.push(str)
      }
    }
  }

  return hardcoded
}

function main() {
  const srcDir = path.join(__dirname, '..')
  const localeDir = path.join(srcDir, 'i18n', 'locales')

  console.log('Scanning i18n usage...\n')

  const localeKeys = getLocaleKeys(localeDir)
  const usedKeys = scanSourceFiles(srcDir)
  const hardcodedStrings = findHardcodedStrings(srcDir)

  // Find unused keys per locale
  const unusedKeys: Record<string, string[]> = {}
  for (const [locale, keys] of Object.entries(localeKeys)) {
    unusedKeys[locale] = Array.from(keys).filter((k) => !usedKeys.has(k))
  }

  // Find missing translations
  const enKeys = localeKeys['en'] || new Set()
  const missingInLocales: Record<string, string[]> = {}
  for (const [locale, keys] of Object.entries(localeKeys)) {
    if (locale !== 'en') {
      missingInLocales[locale] = Array.from(enKeys).filter((k) => !keys.has(k))
    }
  }

  const report: UsageReport = {
    unusedKeys,
    hardcodedStrings,
    missingInLocales,
    summary: {
      totalKeys: enKeys.size,
      usedKeys: Array.from(usedKeys).filter((k) => enKeys.has(k)).length,
      unusedKeys: unusedKeys['en']?.length || 0,
      hardcodedStrings: hardcodedStrings.length,
    },
  }

  // Print report
  console.log('📊 I18N USAGE REPORT')
  console.log('='.repeat(60))

  console.log('\n✓ Summary:')
  console.log(`  Total keys (en): ${report.summary.totalKeys}`)
  console.log(`  Used keys: ${report.summary.usedKeys}`)
  console.log(`  Unused keys: ${report.summary.unusedKeys}`)
  console.log(`  Hardcoded strings: ${report.summary.hardcodedStrings}`)

  if (report.summary.unusedKeys > 0) {
    console.log('\n⚠ Unused Keys (en):')
    report.unusedKeys['en']?.forEach((k) => console.log(`  - ${k}`))
  }

  if (report.hardcodedStrings.length > 0) {
    console.log('\n⚠ Hardcoded Strings (should be in i18n):')
    report.hardcodedStrings.forEach((s) => console.log(`  - "${s}"`))
  }

  if (Object.keys(report.missingInLocales).length > 0) {
    console.log('\n⚠ Missing Translations:')
    for (const [locale, keys] of Object.entries(report.missingInLocales)) {
      if (keys.length > 0) {
        console.log(`  ${locale}: ${keys.length} missing`)
        keys.slice(0, 5).forEach((k) => console.log(`    - ${k}`))
        if (keys.length > 5) console.log(`    ... and ${keys.length - 5} more`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Report saved to: i18n-usage-report.json')

  // Write JSON report
  fs.writeFileSync(
    path.join(process.cwd(), 'i18n-usage-report.json'),
    JSON.stringify(report, null, 2)
  )
}

main()
