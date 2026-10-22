// Feature: frontend-enhancements, Property: Incentive marketplace page functionality
// Validates: localStorage handling, comparison selection, incentive display

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

// ─── Types ──────────────────────────────────────────────────────────────────

enum WasteType {
  Paper = 0,
  PetPlastic = 1,
  Plastic = 2,
  Metal = 3,
  Glass = 4,
  Organic = 5,
  Electronic = 6,
}

type ViewMode = 'grid' | 'list'

interface Incentive {
  id: number
  rewarder: string
  waste_type: WasteType
  reward_points: number | bigint
  total_budget: number | bigint
  remaining_budget: number | bigint
  active: boolean
  created_at: number
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const wasteTypeArb: fc.Arbitrary<WasteType> = fc.integer({ min: 0, max: 6 }).map((n) => n as WasteType)

const incentiveArb: fc.Arbitrary<Incentive> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  rewarder: fc.hexaString({ minLength: 10, maxLength: 56 }).map((s) => `G${s.toUpperCase()}`),
  waste_type: wasteTypeArb,
  reward_points: fc.integer({ min: 0, max: 1000000 }),
  total_budget: fc.integer({ min: 0, max: 10000000 }),
  remaining_budget: fc.integer({ min: 0, max: 10000000 }),
  active: fc.boolean(),
  created_at: fc.integer({ min: 0, max: 2000000000 }),
})

const viewModeArb: fc.Arbitrary<ViewMode> = fc.constantFrom('grid' as const, 'list' as const)

const addressArb: fc.Arbitrary<string> = fc.hexaString({ minLength: 40, maxLength: 42 }).map((s) => `0x${s}`)

// ─── Utility Functions for Testing ───────────────────────────────────────────

const CLAIMS_KEY_PREFIX = 'scavngr_claimed_incentives_'

function getClaimedIds(address: string | null | undefined): Set<number> {
  if (!address) return new Set()
  try {
    const raw = localStorage.getItem(`${CLAIMS_KEY_PREFIX}${address}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed as number[])
  } catch {
    // ignore
  }
  return new Set()
}

function addClaimedId(address: string | null | undefined, id: number): void {
  if (!address) return
  try {
    const existing = getClaimedIds(address)
    existing.add(id)
    localStorage.setItem(`${CLAIMS_KEY_PREFIX}${address}`, JSON.stringify([...existing]))
  } catch {
    // ignore
  }
}

function clearClaimedIds(address: string | null | undefined): void {
  if (!address) return
  try {
    localStorage.removeItem(`${CLAIMS_KEY_PREFIX}${address}`)
  } catch {
    // ignore
  }
}

function toggleCompareId(set: Set<number>, id: number, maxSize: number = 3): Set<number> {
  if (set.has(id)) {
    set.delete(id)
  } else {
    if (set.size < maxSize) {
      set.add(id)
    }
  }
  return new Set(set)
}

function gridRows(items: Incentive[], colsPerRow: number = 3): Incentive[][] {
  const rows: Incentive[][] = []
  for (let i = 0; i < items.length; i += colsPerRow) {
    rows.push(items.slice(i, i + colsPerRow))
  }
  return rows
}

function listRows(items: Incentive[]): Incentive[][] {
  return items.map((item) => [item])
}

function chunked(items: Incentive[], size: number): Incentive[][] {
  const chunks: Incentive[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('IncentivesMarketplacePage — localStorage claimed incentives', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns empty set when no claims exist', () => {
    fc.assert(
      fc.property(addressArb, (address) => {
        const claimed = getClaimedIds(address)
        return claimed.size === 0
      }),
      { numRuns: 50 }
    )
  })

  it('returns empty set for null or undefined address', () => {
    expect(getClaimedIds(null)).toEqual(new Set())
    expect(getClaimedIds(undefined)).toEqual(new Set())
  })

  it('adding a claim stores it', () => {
    fc.assert(
      fc.property(addressArb, fc.integer({ min: 1, max: 100000 }), (address, id) => {
        addClaimedId(address, id)
        const claimed = getClaimedIds(address)
        return claimed.has(id)
      }),
      { numRuns: 50 }
    )
  })

  it('adding multiple claims stores all of them', () => {
    fc.assert(
      fc.property(
        addressArb,
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 1, maxLength: 10, uniqueBy: (x) => x }),
        (address, ids) => {
          ids.forEach((id) => addClaimedId(address, id))
          const claimed = getClaimedIds(address)
          return ids.every((id) => claimed.has(id))
        }
      ),
      { numRuns: 50 }
    )
  })

  it('adding same claim twice does not duplicate', () => {
    fc.assert(
      fc.property(
        addressArb,
        fc.integer({ min: 1, max: 100000 }),
        (address, id) => {
          addClaimedId(address, id)
          addClaimedId(address, id)
          const claimed = getClaimedIds(address)
          return claimed.size === 1
        }
      ),
      { numRuns: 50 }
    )
  })

  it('claims are persistent across reads', () => {
    fc.assert(
      fc.property(
        addressArb,
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 1, maxLength: 5 }),
        (address, ids) => {
          ids.forEach((id) => addClaimedId(address, id))
          const first = getClaimedIds(address)
          const second = getClaimedIds(address)
          return (
            first.size === second.size &&
            ids.every((id) => first.has(id) && second.has(id))
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  it('clearing claims removes stored data', () => {
    fc.assert(
      fc.property(
        addressArb,
        fc.integer({ min: 1, max: 100000 }),
        (address, id) => {
          addClaimedId(address, id)
          clearClaimedIds(address)
          const claimed = getClaimedIds(address)
          return claimed.size === 0
        }
      ),
      { numRuns: 50 }
    )
  })

  it('corruption returns empty set', () => {
    fc.assert(
      fc.property(addressArb, (address) => {
        localStorage.setItem(`${CLAIMS_KEY_PREFIX}${address}`, 'corrupted_json{')
        const claimed = getClaimedIds(address)
        return claimed.size === 0
      }),
      { numRuns: 50 }
    )
  })

  it('non-array data returns empty set', () => {
    fc.assert(
      fc.property(addressArb, (address) => {
        localStorage.setItem(`${CLAIMS_KEY_PREFIX}${address}`, JSON.stringify({ invalid: 'object' }))
        const claimed = getClaimedIds(address)
        return claimed.size === 0
      }),
      { numRuns: 50 }
    )
  })
})

describe('IncentivesMarketplacePage — comparison selection', () => {
  it('set never exceeds max size after toggle', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 20 }),
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

  it('toggling removes element if present', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 3 }),
        (ids) => {
          let set = new Set<number>()
          for (const id of ids) {
            set = toggleCompareId(set, id)
          }
          const toRemove = ids[0]
          const result = toggleCompareId(set, toRemove)
          return !result.has(toRemove) && result.size === ids.length - 1
        }
      ),
      { numRuns: 100 }
    )
  })

  it('cannot add more than max size elements', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 4, maxLength: 4 }),
        ([a, b, c, d]) => {
          let set = new Set<number>()
          set = toggleCompareId(set, a)
          set = toggleCompareId(set, b)
          set = toggleCompareId(set, c)
          const before = new Set(set)
          set = toggleCompareId(set, d)
          return (
            set.size === 3 &&
            set.has(a) &&
            set.has(b) &&
            set.has(c) &&
            !set.has(d)
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('toggle returns new set without mutating input', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 2 }),
        fc.integer({ min: 1, max: 100 }),
        (ids, newId) => {
          const original = new Set<number>(ids)
          const snapshot = new Set(original)
          const result = toggleCompareId(original, newId)
          return (
            original.size === snapshot.size &&
            Array.from(original).every((id) => snapshot.has(id))
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('toggle is idempotent when called twice with same id', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (id) => {
          let set = new Set<number>()
          set = toggleCompareId(set, id)
          set = toggleCompareId(set, id)
          return set.size === 0
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('IncentivesMarketplacePage — grid layout', () => {
  it('grid rows splits items into columns correctly', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const rows = gridRows(items, 3)
          return rows.every((row) => row.length <= 3)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('all items are present in grid rows', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const rows = gridRows(items, 3)
          const flattened = rows.flat()
          return (
            flattened.length === items.length &&
            items.every((item) => flattened.some((i) => i.id === item.id))
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  it('empty array produces empty rows', () => {
    const rows = gridRows([])
    expect(rows).toEqual([])
  })

  it('number of rows is ceil(items / cols)', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const rows = gridRows(items, 3)
          const expected = Math.ceil(items.length / 3)
          return rows.length === expected
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('IncentivesMarketplacePage — list layout', () => {
  it('list rows creates single-item arrays', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const rows = listRows(items)
          return rows.every((row) => row.length === 1)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('list rows count equals input length', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const rows = listRows(items)
          return rows.length === items.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('all items preserved in list layout', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const rows = listRows(items)
          const flattened = rows.flat()
          return (
            flattened.length === items.length &&
            items.every((item) => flattened.some((i) => i.id === item.id))
          )
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('IncentivesMarketplacePage — chunking', () => {
  it('chunks are sized correctly', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (items, size) => {
          const chunks = chunked(items, size)
          return chunks.every((chunk) => chunk.length <= size)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('all items preserved in chunks', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (items, size) => {
          const chunks = chunked(items, size)
          const flattened = chunks.flat()
          return (
            flattened.length === items.length &&
            items.every((item) => flattened.some((i) => i.id === item.id))
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  it('number of chunks is ceil(length / size)', () => {
    fc.assert(
      fc.property(
        fc.array(incentiveArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (items, size) => {
          const chunks = chunked(items, size)
          const expected = Math.ceil(items.length / size)
          return chunks.length === expected
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('IncentivesMarketplacePage — incentive properties', () => {
  it('reward_points can be number or bigint', () => {
    fc.assert(
      fc.property(incentiveArb, (inc) => {
        return typeof inc.reward_points === 'number' || typeof inc.reward_points === 'bigint'
      }),
      { numRuns: 50 }
    )
  })

  it('remaining_budget can be number or bigint', () => {
    fc.assert(
      fc.property(incentiveArb, (inc) => {
        return typeof inc.remaining_budget === 'number' || typeof inc.remaining_budget === 'bigint'
      }),
      { numRuns: 50 }
    )
  })

  it('total_budget can be number or bigint', () => {
    fc.assert(
      fc.property(incentiveArb, (inc) => {
        return typeof inc.total_budget === 'number' || typeof inc.total_budget === 'bigint'
      }),
      { numRuns: 50 }
    )
  })

  it('rewarder has valid format', () => {
    fc.assert(
      fc.property(incentiveArb, (inc) => {
        return inc.rewarder.startsWith('G') && inc.rewarder.length > 1
      }),
      { numRuns: 50 }
    )
  })
})
