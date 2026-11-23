import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Gitleaks Pre-commit Config (Issue #1779)', () => {
  const repoRoot = path.resolve(__dirname, '../..')

  it('should have a .gitleaks.toml config file', () => {
    const configPath = path.join(repoRoot, '.gitleaks.toml')
    expect(fs.existsSync(configPath)).toBe(true)
  })

  it('should have gitleaks configured in .pre-commit-config.yaml', () => {
    const configPath = path.join(repoRoot, '.pre-commit-config.yaml')
    expect(fs.existsSync(configPath)).toBe(true)

    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content).toContain('gitleaks')
    expect(content).toContain('.gitleaks.toml')
  })

  it('should reference gitleaks in CONTRIBUTING.md pre-commit section', () => {
    const contributingPath = path.join(repoRoot, 'CONTRIBUTING.md')
    const content = fs.readFileSync(contributingPath, 'utf-8')
    expect(content.toLowerCase()).toContain('gitleaks')
  })
})
