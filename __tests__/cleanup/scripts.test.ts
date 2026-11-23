import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Scripts Cleanup (Issue #1778)', () => {
  const scriptsDir = path.resolve(__dirname, '../../scripts')

  it('should not have duplicate run-perf-tests.sh in scripts/', () => {
    // The canonical performance test runner lives in performance/run-perf-tests.sh
    const duplicate = path.join(scriptsDir, 'run-perf-tests.sh')
    expect(fs.existsSync(duplicate)).toBe(false)
  })

  it('should not have the superseded seed.sql stub', () => {
    // seed-test-data.sql is the canonical SQL seeder; seed.sql was a minimal stub
    const staleSeed = path.join(scriptsDir, 'seed.sql')
    expect(fs.existsSync(staleSeed)).toBe(false)
  })

  it('should not have snake_case run_fuzz_tests.sh (renamed to kebab-case)', () => {
    const oldName = path.join(scriptsDir, 'run_fuzz_tests.sh')
    expect(fs.existsSync(oldName)).toBe(false)
  })

  it('should have the renamed run-fuzz-tests.sh', () => {
    const newName = path.join(scriptsDir, 'run-fuzz-tests.sh')
    expect(fs.existsSync(newName)).toBe(true)
  })

  it('should use kebab-case for all .sh filenames in scripts/', () => {
    if (!fs.existsSync(scriptsDir)) return

    const files = fs.readdirSync(scriptsDir)
    const shFiles = files.filter((f) => f.endsWith('.sh'))

    for (const file of shFiles) {
      // kebab-case: lowercase letters, digits, and hyphens only
      const baseName = file.replace(/\.sh$/, '')
      expect(baseName).toMatch(
        /^[a-z][a-z0-9-]*$/,
        `Script "${file}" should use kebab-case (lowercase, hyphens, no underscores)`
      )
    }
  })

  it('should not reference non-existent scripts in README.md', () => {
    const readmePath = path.join(scriptsDir, 'README.md')
    if (!fs.existsSync(readmePath)) return

    const content = fs.readFileSync(readmePath, 'utf-8')

    // Scripts that were consolidated and should no longer be listed individually
    const removedScripts = [
      'release-automation.sh',
      'release-notes.sh',
      'release-tracking.sh',
      'changelog-generator.sh',
      'cost-analysis.sh',
      'cost-report.sh',
      'cost-allocation.sh',
      'cost-optimization-recommendations.sh',
      'capacity-report.sh'
    ]

    for (const script of removedScripts) {
      // Allow mentions in the consolidation note (e.g. "Consolidates the former ...")
      // but not as inventory table entries (backtick-quoted in a table row)
      const tableEntryPattern = new RegExp(`\\| \`${script}\``)
      expect(
        tableEntryPattern.test(content),
        `README should not list removed script "${script}" as a table entry`
      ).toBe(false)
    }
  })
})
