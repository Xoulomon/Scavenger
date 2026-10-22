import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { FRONTEND_ROOT } from '@/test-utils/source-scan'

describe('frontend ESLint configuration', () => {
  it('uses a single flat config and no legacy .eslintrc.cjs', () => {
    expect(existsSync(join(FRONTEND_ROOT, '.eslintrc.cjs'))).toBe(false)
    expect(existsSync(join(FRONTEND_ROOT, 'eslint.config.js'))).toBe(true)
  })

  it('keeps the rules the legacy config enforced', () => {
    const flat = readFileSync(join(FRONTEND_ROOT, 'eslint.config.js'), 'utf8')
    expect(flat).toContain("'no-console': ['error', { allow: ['warn', 'error'] }]")
    expect(flat).toContain("'no-debugger': 'error'")
    expect(flat).toContain("'@typescript-eslint/no-explicit-any': 'error'")
  })
})
