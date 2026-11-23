import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Regression test for Issue #1781: Resolve all TODO/FIXME with issues or removal.
 *
 * Scans all source files (Rust, TypeScript, JavaScript) for unresolved
 * TODO, FIXME, todo!(), and unimplemented!() markers. These markers
 * represent incomplete work that should be tracked via GitHub issues
 * instead of inline comments.
 */
describe('TODO/FIXME Resolution (Issue #1781)', () => {
  const repoRoot = path.resolve(__dirname, '../..')

  // Directories to skip — test fixtures, docs, and generated code may
  // legitimately contain these terms in non-marker contexts.
  const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', 'docs']

  // Patterns that indicate an actionable marker (not just the word in prose)
  const rustMarkerPattern =
    /\btodo!\s*\(|\bunimplemented!\s*\(|\/\/\s*TODO\b|\/\/\s*FIXME\b|\/\/\s*HACK\b|\/\/\s*XXX\b/i
  const tsMarkerPattern = /\/\/\s*TODO\b|\/\/\s*FIXME\b|\/\/\s*HACK\b|\/\/\s*XXX\b/i

  function scanDir(dir: string, results: string[]) {
    if (!fs.existsSync(dir)) return

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (skipDirs.includes(entry.name)) continue
        scanDir(fullPath, results)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)

        if (ext === '.rs') {
          const content = fs.readFileSync(fullPath, 'utf-8')
          if (rustMarkerPattern.test(content)) {
            results.push(fullPath)
          }
        } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
          // Skip test files and config files that reference these terms as lint config
          if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue
          if (entry.name === 'eslint.config.js' || entry.name === 'eslint.config.base.js') continue

          const content = fs.readFileSync(fullPath, 'utf-8')
          if (tsMarkerPattern.test(content)) {
            results.push(fullPath)
          }
        }
      }
    }
  }

  it('should not have unresolved todo!() or unimplemented!() in Rust source', () => {
    const results: string[] = []
    scanDir(path.join(repoRoot, 'backend', 'src'), results)
    scanDir(path.join(repoRoot, 'stellar-contract', 'src'), results)
    expect(results).toEqual([])
  })

  it('should not have unresolved TODO/FIXME comments in TypeScript/JavaScript source', () => {
    const results: string[] = []
    scanDir(path.join(repoRoot, 'frontend', 'src'), results)
    scanDir(path.join(repoRoot, 'indexer', 'src'), results)
    scanDir(path.join(repoRoot, 'packages'), results)
    expect(results).toEqual([])
  })

  it('should not have the removed app_with_counter todo!() in idempotency.rs', () => {
    const filePath = path.join(repoRoot, 'backend', 'src', 'middleware', 'idempotency.rs')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain('todo!()')
    expect(content).not.toContain('app_with_counter')
  })
})
