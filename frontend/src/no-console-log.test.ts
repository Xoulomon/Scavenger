import { describe, it, expect } from 'vitest'
import { findMatches, listProductionSourceFiles } from '@/test-utils/source-scan'

describe('no console.log in production source', () => {
  it('has no console.log/debug/info outside tests, stories and Node scripts', () => {
    // src/scripts/ holds Node CLI tools whose output is their purpose, not app logging.
    const files = listProductionSourceFiles().filter((f) => !f.startsWith('src/scripts/'))
    expect(findMatches(files, /\bconsole\.(log|debug|info)\(/)).toEqual([])
  })
})
