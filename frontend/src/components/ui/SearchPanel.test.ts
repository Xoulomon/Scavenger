// Feature: frontend-enhancements, Property 11: Active filter count matches applied filters
// Validates: Requirements 7.4

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { WasteType } from '@/api/types'
import { countActiveFilters, DEFAULT_FILTERS } from '@/components/ui/SearchPanel'
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
  wasteTypes: fc.array(wasteTypeArb, { minLength: 0, maxLength: 5 }),
  status: statusArb,
  dateFrom: fc.option(isoDateArb, { nil: null }),
  dateTo: fc.option(isoDateArb, { nil: null }),
  location: fc.string({ minLength: 0, maxLength: 50 })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchPanel — Property 11: active filter count matches applied filters', () => {
  it('default filters produce a count of 0', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
  })

  it('count equals the number of fields that differ from defaults', () => {
    fc.assert(
      fc.property(searchFiltersArb, (filters) => {
        const expected =
          (filters.wasteTypes.length > 0 ? 1 : 0) +
          (filters.status !== 'all' ? 1 : 0) +
          (filters.dateFrom !== null ? 1 : 0) +
          (filters.dateTo !== null ? 1 : 0) +
          (filters.location.trim() !== '' ? 1 : 0)

        return countActiveFilters(filters) === expected
      }),
      { numRuns: 100 }
    )
  })

  it('count is always between 0 and 5 (one per filter field)', () => {
    fc.assert(
      fc.property(searchFiltersArb, (filters) => {
        const count = countActiveFilters(filters)
        return count >= 0 && count <= 5
      }),
      { numRuns: 100 }
    )
  })

  it('count is non-negative for any filter state', () => {
    fc.assert(
      fc.property(searchFiltersArb, (filters) => {
        return countActiveFilters(filters) >= 0
      }),
      { numRuns: 100 }
    )
  })

  it('each individual filter field contributes exactly 1 to the count when active', () => {
    // wasteTypes
    expect(countActiveFilters({ ...DEFAULT_FILTERS, wasteTypes: [WasteType.Paper] })).toBe(1)
    // status
    expect(countActiveFilters({ ...DEFAULT_FILTERS, status: 'active' })).toBe(1)
    // dateFrom
    expect(countActiveFilters({ ...DEFAULT_FILTERS, dateFrom: '2024-01-01' })).toBe(1)
    // dateTo
    expect(countActiveFilters({ ...DEFAULT_FILTERS, dateTo: '2024-12-31' })).toBe(1)
    // location
    expect(countActiveFilters({ ...DEFAULT_FILTERS, location: 'Lagos' })).toBe(1)
  })

  it('all five fields active produces count of 5', () => {
    const allActive: SearchFilters = {
      wasteTypes: [WasteType.Metal],
      status: 'confirmed',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      location: 'Nairobi'
    }
    expect(countActiveFilters(allActive)).toBe(5)
  })

  it('location with only whitespace is treated as default (not active)', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\s+$/), (whitespaceOnly) => {
        const filters: SearchFilters = { ...DEFAULT_FILTERS, location: whitespaceOnly }
        return countActiveFilters(filters) === 0
      }),
      { numRuns: 50 }
    )
  })
})
