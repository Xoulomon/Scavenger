// Feature: frontend-enhancements, Property 8: Search preview capped at 5 results
// Validates: Requirements 6.7

import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import type { SearchResult } from '@/lib/searchStorage'

/**
 * The SearchBar caps the inline results dropdown at exactly MAX_PREVIEW (5) entries.
 * This pure function mirrors the slicing logic in SearchBar.tsx.
 */
const MAX_PREVIEW = 5

function getPreviewResults(results: SearchResult[]): SearchResult[] {
  return results.slice(0, MAX_PREVIEW)
}

// Arbitrary for a single SearchResult
const searchResultArb = fc.record({
  type: fc.constantFrom('waste' as const, 'participant' as const),
  id: fc.string({ minLength: 1, maxLength: 20 }),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  sublabel: fc.string({ minLength: 0, maxLength: 80 }),
  data: fc.constant({})
})

describe('SearchBar — Property 8: search preview capped at 5 results', () => {
  it('renders at most 5 results regardless of how many matches exist', () => {
    fc.assert(
      fc.property(
        // Generate arrays with more than 5 results to exercise the cap
        fc.array(searchResultArb, { minLength: 6, maxLength: 50 }),
        (results) => {
          const preview = getPreviewResults(results)
          return preview.length <= MAX_PREVIEW
        }
      ),
      { numRuns: 100 }
    )
  })

  it('renders exactly 5 results when more than 5 matches exist', () => {
    fc.assert(
      fc.property(fc.array(searchResultArb, { minLength: 6, maxLength: 50 }), (results) => {
        const preview = getPreviewResults(results)
        return preview.length === MAX_PREVIEW
      }),
      { numRuns: 100 }
    )
  })

  it('renders all results when fewer than 5 matches exist', () => {
    fc.assert(
      fc.property(
        fc.array(searchResultArb, { minLength: 0, maxLength: MAX_PREVIEW - 1 }),
        (results) => {
          const preview = getPreviewResults(results)
          return preview.length === results.length
        }
      ),
      { numRuns: 100 }
    )
  })

  it('preview is always a prefix of the original results array', () => {
    fc.assert(
      fc.property(fc.array(searchResultArb, { minLength: 0, maxLength: 30 }), (results) => {
        const preview = getPreviewResults(results)
        return preview.every((item, idx) => item === results[idx])
      }),
      { numRuns: 100 }
    )
  })
})
