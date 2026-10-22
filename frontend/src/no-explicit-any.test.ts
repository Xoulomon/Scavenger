import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { FRONTEND_ROOT, findMatches, listProductionSourceFiles } from '@/test-utils/source-scan'

describe('no explicit any in production source', () => {
  it('has no `: any` or `as any` outside tests and stories', () => {
    const hits = findMatches(listProductionSourceFiles(), /:\s*any\b|\bas any\b/)
    expect(hits).toEqual([])
  })

  it('keeps @typescript-eslint/no-explicit-any as an error', () => {
    const flat = readFileSync(join(FRONTEND_ROOT, 'eslint.config.js'), 'utf8')
    expect(flat).toContain("'@typescript-eslint/no-explicit-any': 'error'")
  })
})
