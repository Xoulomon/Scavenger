// Feature: frontend-enhancements, Property 12: Search results URL round-trip
// Validates: Requirements 9.5

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { WasteType } from '@/api/types'
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/searchStorage'
import type { SearchFilters } from '@/lib/searchStorage'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const wasteTypeArb = fc.constantFrom(
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass
)

const statusArb = fc.constantFrom(
  'all' as const,
  'active' as const,
  'confirmed' as const,
  'inactive' as const
)

const isoDateArb = fc.integer({ min: 2020, max: 2030 }).chain((year) =>
  fc.integer({ min: 1, max: 12 }).chain((month) =>
    fc.integer({ min: 1, max: 28 }).map((day) => {
      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      return `${year}-${mm}-${dd}`
    })
  )
)

const searchFiltersArb: fc.Arbitrary<SearchFilters> = fc.record({
  wasteTypes: fc.uniqueArray(wasteTypeArb, { minLength: 0, maxLength: 5 }),
  status: statusArb,
  dateFrom: fc.option(isoDateArb, { nil: null }),
  dateTo: fc.option(isoDateArb, { nil: null }),
  location: fc.string({ minLength: 0, maxLength: 50 }).map((s) => s.trim())
})

// Non-empty printable query strings (no leading/trailing whitespace)
const queryArb = fc.string({ minLength: 0, maxLength: 80 }).map((s) => s.trim())

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('searchStorage — Property 12: search results URL round-trip', () => {
  it('query round-trips through URL params', () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        const params = filtersToSearchParams(query, {
          wasteTypes: [],
          status: 'all',
          dateFrom: null,
          dateTo: null,
          location: ''
        })
        const { query: parsed } = searchParamsToFilters(params)
        return parsed === query
      }),
      { numRuns: 100 }
    )
  })

  it('filters round-trip through URL params', () => {
    fc.assert(
      fc.property(queryArb, searchFiltersArb, (query, filters) => {
        const params = filtersToSearchParams(query, filters)
        const { query: parsedQuery, filters: parsedFilters } = searchParamsToFilters(params)

        // Query must match
        if (parsedQuery !== query) return false

        // Status must match
        if (parsedFilters.status !== filters.status) return false

        // wasteTypes must contain the same values (order may differ after parse)
        const sortedOriginal = [...filters.wasteTypes].sort()
        const sortedParsed = [...parsedFilters.wasteTypes].sort()
        if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedParsed)) return false

        // dateFrom / dateTo must match
        if (parsedFilters.dateFrom !== filters.dateFrom) return false
        if (parsedFilters.dateTo !== filters.dateTo) return false

        // location must match
        if (parsedFilters.location !== filters.location) return false

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('serialising default filters produces no extra params beyond q', () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        const defaultFilters: SearchFilters = {
          wasteTypes: [],
          status: 'all',
          dateFrom: null,
          dateTo: null,
          location: ''
        }
        const params = filtersToSearchParams(query, defaultFilters)
        // Only 'q' should be present (when query is non-empty)
        const keys = [...params.keys()]
        const expectedKeys = query ? ['q'] : []
        return JSON.stringify(keys.sort()) === JSON.stringify(expectedKeys.sort())
      }),
      { numRuns: 100 }
    )
  })

  it('parsing empty URLSearchParams returns default filters and empty query', () => {
    const { query, filters } = searchParamsToFilters(new URLSearchParams())
    expect(query).toBe('')
    expect(filters.status).toBe('all')
    expect(filters.wasteTypes).toEqual([])
    expect(filters.dateFrom).toBeNull()
    expect(filters.dateTo).toBeNull()
    expect(filters.location).toBe('')
  })

  it('invalid status value falls back to "all"', () => {
    const params = new URLSearchParams({ status: 'bogus' })
    const { filters } = searchParamsToFilters(params)
    expect(filters.status).toBe('all')
  })

  it('invalid wasteType values are filtered out', () => {
    const params = new URLSearchParams({ wasteTypes: '0,99,-1,abc,3' })
    const { filters } = searchParamsToFilters(params)
    // Only 0 and 3 are valid WasteType values
    expect(filters.wasteTypes).toEqual([WasteType.Paper, WasteType.Metal])
  })
})
