import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Naming Conventions (Issue #1780)', () => {
  const repoRoot = path.resolve(__dirname, '../..')

  it('should not have a stale .eslintrc.cjs in frontend', () => {
    const staleConfig = path.join(repoRoot, 'frontend', '.eslintrc.cjs')
    expect(fs.existsSync(staleConfig)).toBe(false)
  })

  it('should have a single eslint.config.js in frontend', () => {
    const flatConfig = path.join(repoRoot, 'frontend', 'eslint.config.js')
    expect(fs.existsSync(flatConfig)).toBe(true)
  })

  it('should enforce no-warning-comments with hack term in frontend eslint config', () => {
    const configPath = path.join(repoRoot, 'frontend', 'eslint.config.js')
    const content = fs.readFileSync(configPath, 'utf-8')

    // The no-warning-comments rule should include 'hack' in its terms
    // and be set to 'error' (not 'warn')
    const warningCommentsBlocks = content.match(
      /no-warning-comments'?:\s*\[\s*['"]error['"]\s*,\s*\{[^}]*'hack'[^}]*\}/g
    )
    expect(warningCommentsBlocks).not.toBeNull()
    expect(warningCommentsBlocks!.length).toBeGreaterThan(0)
  })

  it('should use kebab-case for all .sh scripts in scripts/', () => {
    const scriptsDir = path.join(repoRoot, 'scripts')
    if (!fs.existsSync(scriptsDir)) return

    const files = fs.readdirSync(scriptsDir)
    const shFiles = files.filter((f) => f.endsWith('.sh'))

    for (const file of shFiles) {
      const baseName = file.replace(/\.sh$/, '')
      expect(baseName).toMatch(/^[a-z][a-z0-9-]*$/, `Script "${file}" should use kebab-case`)
    }
  })

  it('should not have duplicate eslint configs in frontend', () => {
    const frontendDir = path.join(repoRoot, 'frontend')
    const files = fs.readdirSync(frontendDir)
    const eslintConfigs = files.filter((f) => f.startsWith('.eslintrc') || f === 'eslint.config.js')

    // Should only have the flat config
    expect(eslintConfigs).toEqual(['eslint.config.js'])
  })

  it('should document naming conventions in CONTRIBUTING.md', () => {
    const contributing = path.join(repoRoot, 'CONTRIBUTING.md')
    const content = fs.readFileSync(contributing, 'utf-8')

    expect(content).toContain('PascalCase')
    expect(content).toContain('camelCase')
    expect(content).toContain('kebab-case')
  })
})
