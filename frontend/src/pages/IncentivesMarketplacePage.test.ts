// Feature: frontend-enhancements, Property 13: Incentive sort correctness
// Feature: frontend-enhancements, Property 14: Incentive filter correctness
// Feature: frontend-enhancements, Property 15: View preference persistence
// Validates: Requirements 10.2, 10.3, 10.4

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { WasteType } from '@/api/types'
import type { Incentive } from '@/api/types'
import {
  sortIncentives,
  filterIncentives,
  readViewMode,
  writeViewMode,
  VIEW_STORAGE_KEY,
  type SortField,
  type SortDir,
  type IncentiveFilters,
  type ViewMode
} from '@/lib/incentivesUtils'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const wasteTypeArb = fc.constantFrom(
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass
)

const incentiveArb: fc.Arbitrary<Incentive> = fc.record({
  id: fc.integer({ min: 1, max: 10_000 }),
  rewarder: fc.hexaString({ minLength: 10, maxLength: 56 }).map((s) => `G${s.toUpperCase()}`),
  waste_type: wasteTypeArb,
  reward_points: fc.integer({ min: 0, max: 1_000_000 }),
  total_budget: fc.integer({ min: 0, max: 10_000_000 }),
  remaining_budget: fc.integer({ min: 0, max: 10_000_000 }),
  active: fc.boolean(),
  created_at: fc.integer({ min: 0, max: 2_000_000_000 })
})

const sortFieldArb: fc.Arbitrary<SortField> = fc.constantFrom(
  'reward_points' as const,
  'remaining_budget' as const,
  'waste_type' as const
)

const sortDirArb: fc.Arbitrary<SortDir> = fc.constantFrom('asc' as const, 'desc' as const)

const incentiveFiltersArb: fc.Arbitrary<IncentiveFilters> = fc.record({
  wasteTypes: fc.array(wasteTypeArb, { minLength: 0, maxLength: 5 }),
  rewarder: fc.string({ minLength: 0, maxLength: 20 })
})

const viewModeArb: fc.Arbitrary<ViewMode> = fc.constantFrom('grid' as const, 'list' as const)

// ─── Property 13: Incentive sort correctness ──────────────────────────────────

describe('IncentivesMarketplacePage — Property 13: incentive sort correctness', () => {
  it('sorted output satisfies total order for reward_points asc', () => {
    fc.assert(
      fc.property(fc.array(incentiveArb, { minLength: 0, maxLength: 50 }), (incentives) => {
        const sorted = sortIncentives(incentives, 'reward_points', 'asc')
        for (let i = 1; i < sorted.length; i++) {
          if (Number(sorted[i - 1].reward_points) > Number(sorted[i].reward_points)) return false
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('sorted output satisfies total order for reward_points desc', () => {
    fc.assert(
      fc.property(fc.array(incentiveArb, { minLength: 0, maxLength: 50 }), (incentives) => {
        const sorted = sortIncentives(incentives, 'reward_points', 'desc')
        for (let i = 1; i < sorted.length; i++) {
          if (Number(sorted[i - 1].reward_points) < Number(sorted[i].reward_points)) return false
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('sorted output satisfies total order for remaining_budget asc', () => {
    fc.assert(
      fc.property(fc.array(incentiveArb, { minLength: 0, maxLength: 50 }), (incentives) => {
        const sorted = sortIncentives(incentives, 'remaining_budget', 'asc')
        for (let i = 1; i < sorted.length; i++) {
          if (Number(sorted[i - 1].remaining_budget) > Number(sorted[i].remaining_budget))
            return false
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('sorted output satisfies total order for remaining_budget desc', () => {
    fc.assert(
      fc.property(fc.array(incentiveArb, { minLength: 0, maxLength: 50 }), (incentives) => {
        const sorted = sortIncentives(incentives, 'remaining_budget', 'desc')
        for (let i = 1; i < sorted.length; i++) {
          if (Number(sorted[i - 1].remaining_budget) < Number(sorted[i].remaining_budget))
            return false
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('sorted output satisfies total order for waste_type asc', () => {
    fc.assert(
      fc.property(fc.array(incentiveArb, { minLength: 0, maxLength: 50 }), (incentives) => {
        const sorted = sortIncentives(incentives, 'waste_type', 'asc')
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i - 1].waste_type > sorted[i].waste_type) return false
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('sort does not mutate the original array', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 1, maxLength: 30 }),
        sortFieldArb,
        sortDirArb,
        (incentives, field, dir) => {
          const original = incentives.map((i) => i.id)
          sortIncentives(incentives, field, dir)
          return incentives.map((i) => i.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('sorted output has the same length as the input', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        sortFieldArb,
        sortDirArb,
        (incentives, field, dir) => {
          return sortIncentives(incentives, field, dir).length === incentives.length
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 14: Incentive filter correctness ────────────────────────────────

describe('IncentivesMarketplacePage — Property 14: incentive filter correctness', () => {
  it('every item in the filtered output satisfies all active filter predicates', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        incentiveFiltersArb,
        (incentives, filters) => {
          const result = filterIncentives(incentives, filters)
          return result.every((inc) => {
            const typeOk =
              filters.wasteTypes.length === 0 || filters.wasteTypes.includes(inc.waste_type)
            const rewarderOk =
              filters.rewarder.trim() === '' ||
              inc.rewarder.toLowerCase().includes(filters.rewarder.trim().toLowerCase())
            return typeOk && rewarderOk
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no item that satisfies all predicates is absent from the output', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        incentiveFiltersArb,
        (incentives, filters) => {
          const result = filterIncentives(incentives, filters)
          const resultIds = new Set(result.map((i) => i.id))
          return incentives
            .filter((inc) => {
              const typeOk =
                filters.wasteTypes.length === 0 || filters.wasteTypes.includes(inc.waste_type)
              const rewarderOk =
                filters.rewarder.trim() === '' ||
                inc.rewarder.toLowerCase().includes(filters.rewarder.trim().toLowerCase())
              return typeOk && rewarderOk
            })
            .every((inc) => resultIds.has(inc.id))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('empty filters return all incentives', () => {
    fc.assert(
      fc.property(fc.array(incentiveArb, { minLength: 0, maxLength: 50 }), (incentives) => {
        const result = filterIncentives(incentives, { wasteTypes: [], rewarder: '' })
        return result.length === incentives.length
      }),
      { numRuns: 100 }
    )
  })

  it('filter does not mutate the original array', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 1, maxLength: 30 }),
        incentiveFiltersArb,
        (incentives, filters) => {
          const original = incentives.map((i) => i.id)
          filterIncentives(incentives, filters)
          return incentives.map((i) => i.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('filtered output length is always <= input length', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        incentiveFiltersArb,
        (incentives, filters) => {
          return filterIncentives(incentives, filters).length <= incentives.length
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 15: View preference persistence ─────────────────────────────────

describe('IncentivesMarketplacePage — Property 15: view preference persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('writing a view mode and reading it back returns the same value', () => {
    fc.assert(
      fc.property(viewModeArb, (mode) => {
        writeViewMode(mode)
        return readViewMode() === mode
      }),
      { numRuns: 100 }
    )
  })

  it('reading without writing returns the default grid mode', () => {
    expect(readViewMode()).toBe('grid')
  })

  it('last write wins when writing multiple times', () => {
    fc.assert(
      fc.property(viewModeArb, viewModeArb, (first, second) => {
        writeViewMode(first)
        writeViewMode(second)
        return readViewMode() === second
      }),
      { numRuns: 100 }
    )
  })

  it('only valid values are returned (never an arbitrary string)', () => {
    // Corrupt the storage with an invalid value
    localStorage.setItem(VIEW_STORAGE_KEY, 'invalid_value')
    expect(readViewMode()).toBe('grid')
  })
})

// ─── Property 16: Comparison selection capped at 3 ───────────────────────────
// Feature: frontend-enhancements, Property 16: Comparison selection capped at 3
// Validates: Requirements 12.1

import { toggleCompareId } from '@/lib/incentivesUtils'

describe('IncentivesMarketplacePage — Property 16: comparison selection capped at 3', () => {
  it('set never exceeds 3 elements after any sequence of toggle actions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 20 }),
        (ids) => {
          let set = new Set<number>()
          for (const id of ids) {
            set = toggleCompareId(set, id)
          }
          return set.size <= 3
        }
      ),
      { numRuns: 100 }
    )
  })

  it('attempting to add a 4th element leaves the set unchanged', () => {
    fc.assert(
      fc.property(
        // Generate 4 distinct IDs
        fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 4, maxLength: 4 }),
        ([a, b, c, d]) => {
          let set = new Set<number>()
          set = toggleCompareId(set, a)
          set = toggleCompareId(set, b)
          set = toggleCompareId(set, c)
          // set now has 3 elements; adding d should leave it unchanged
          const before = new Set(set)
          const after = toggleCompareId(set, d)
          return (
            after.size === 3 &&
            after.has(a) &&
            after.has(b) &&
            after.has(c) &&
            !after.has(d) &&
            // original set is not mutated
            before.size === set.size
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('toggling an already-selected ID removes it from the set', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 3 }),
        (ids) => {
          let set = new Set<number>()
          for (const id of ids) {
            set = toggleCompareId(set, id)
          }
          // Now deselect each one
          for (const id of ids) {
            set = toggleCompareId(set, id)
          }
          return set.size === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  it('toggleCompareId does not mutate the input set', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 3 }),
        fc.integer({ min: 1, max: 100 }),
        (ids, newId) => {
          const original = new Set<number>(ids)
          const snapshot = new Set(original)
          toggleCompareId(original, newId)
          // original must be unchanged
          if (original.size !== snapshot.size) return false
          for (const id of snapshot) {
            if (!original.has(id)) return false
          }
          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
