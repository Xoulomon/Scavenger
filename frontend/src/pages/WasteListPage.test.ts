// Feature: frontend-enhancements, Property: Waste list filtering, pagination, and selection
// Validates: Waste filtering, status determination, pagination correctness, batch selection

import { describe, it, expect } from 'vitest'
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

type StatusFilter = 'all' | 'active' | 'confirmed' | 'inactive'

interface Material {
  id: number
  waste_type: number
  is_active: boolean
  is_confirmed: boolean
  verified: boolean
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const wasteTypeArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 6 })

const materialArb: fc.Arbitrary<Material> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  waste_type: wasteTypeArb,
  is_active: fc.boolean(),
  is_confirmed: fc.boolean(),
  verified: fc.boolean(),
})

// ─── Utility Functions for Testing ───────────────────────────────────────────

const PAGE_SIZE = 10

function getStatus(w: Material): StatusFilter {
  if (!w.is_active) return 'inactive'
  if (w.is_confirmed) return 'confirmed'
  return 'active'
}

function filterWaste(
  wastes: Material[],
  search: string,
  typeFilter: string,
  statusFilter: string
): Material[] {
  return wastes.filter((w) => {
    if (search && !String(w.id).includes(search.trim())) return false
    if (typeFilter !== 'all' && w.waste_type !== Number(typeFilter)) return false
    if (statusFilter !== 'all' && getStatus(w) !== statusFilter) return false
    return true
  })
}

function paginate(
  items: Material[],
  page: number,
  pageSize: number = PAGE_SIZE
): Material[] {
  if (page < 1) page = 1
  return items.slice((page - 1) * pageSize, page * pageSize)
}

function calculateTotalPages(itemCount: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(itemCount / pageSize))
}

function toggleSelection(selected: number[], id: number): number[] {
  return selected.includes(id)
    ? selected.filter((sid) => sid !== id)
    : [...selected, id]
}

function selectAllOnPage(
  selected: number[],
  pageItems: Material[],
  allSelected: boolean
): number[] {
  const pageIds = pageItems.map((w) => w.id)
  if (allSelected) {
    return selected.filter((id) => !pageIds.includes(id))
  } else {
    return [...new Set([...selected, ...pageIds])]
  }
}

function countSelectableByStatus(wastes: Material[], status: 'confirmable' | 'verifiable' | 'transferable'): number {
  switch (status) {
    case 'confirmable':
      return wastes.filter((w) => w.is_active && !w.is_confirmed).length
    case 'verifiable':
      return wastes.filter((w) => !w.verified).length
    case 'transferable':
      return wastes.filter((w) => w.is_active).length
    default:
      return 0
  }
}

function filterByWasteType(wastes: Material[], typeFilter: string): Material[] {
  if (typeFilter === 'all') return wastes
  const typeNum = Number(typeFilter)
  return wastes.filter((w) => w.waste_type === typeNum)
}

function filterByStatus(wastes: Material[], statusFilter: string): Material[] {
  if (statusFilter === 'all') return wastes
  return wastes.filter((w) => getStatus(w) === statusFilter)
}

function filterBySearch(wastes: Material[], search: string): Material[] {
  if (!search) return wastes
  return wastes.filter((w) => String(w.id).includes(search.trim()))
}

function getWasteLabel(type: number): string {
  const labels: Record<number, string> = {
    0: 'Paper',
    1: 'PET Plastic',
    2: 'Plastic',
    3: 'Metal',
    4: 'Glass',
    5: 'Organic',
    6: 'Electronic',
  }
  return labels[type] || 'Unknown'
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('WasteListPage — waste status determination', () => {
  it('inactive waste returns inactive status', () => {
    fc.assert(
      fc.property(materialArb.filter(m => !m.is_active), (w) => {
        return getStatus(w) === 'inactive'
      }),
      { numRuns: 50 }
    )
  })

  it('active but confirmed waste returns confirmed status', () => {
    fc.assert(
      fc.property(
        materialArb.filter(m => m.is_active && m.is_confirmed),
        (w) => {
          return getStatus(w) === 'confirmed'
        }
      ),
      { numRuns: 50 }
    )
  })

  it('active but not confirmed waste returns active status', () => {
    fc.assert(
      fc.property(
        materialArb.filter(m => m.is_active && !m.is_confirmed),
        (w) => {
          return getStatus(w) === 'active'
        }
      ),
      { numRuns: 50 }
    )
  })

  it('status is always one of valid values', () => {
    fc.assert(
      fc.property(materialArb, (w) => {
        const status = getStatus(w)
        return ['active', 'confirmed', 'inactive'].includes(status)
      }),
      { numRuns: 50 }
    )
  })
})

describe('WasteListPage — waste filtering', () => {
  it('returns all wastes when all filters are default', () => {
    fc.assert(
      fc.property(fc.array(materialArb, { minLength: 0, maxLength: 50 }), (wastes) => {
        const filtered = filterWaste(wastes, '', 'all', 'all')
        return filtered.length === wastes.length
      }),
      { numRuns: 50 }
    )
  })

  it('type filter returns only matching waste types', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: 50 }),
        wasteTypeArb,
        (wastes, type) => {
          const filtered = filterWasteType(wastes, String(type))
          return filtered.every((w) => w.waste_type === type)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('status filter returns only matching statuses', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: 50 }),
        (wastes) => {
          const filtered = filterByStatus(wastes, 'active')
          return filtered.every((w) => getStatus(w) === 'active')
        }
      ),
      { numRuns: 50 }
    )
  })

  it('search by ID includes only matching IDs', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: 50 }),
        (wastes) => {
          if (wastes.length === 0) return true
          const search = String(wastes[0].id)
          const filtered = filterBySearch(wastes, search)
          return filtered.every((w) => String(w.id).includes(search))
        }
      ),
      { numRuns: 50 }
    )
  })

  it('combined filters apply all predicates', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: 50 }),
        wasteTypeArb,
        (wastes, type) => {
          const filtered = filterWaste(wastes, '', String(type), 'active')
          return filtered.every((w) => w.waste_type === type && getStatus(w) === 'active')
        }
      ),
      { numRuns: 50 }
    )
  })

  it('filtering does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: 50 }),
        (wastes) => {
          const original = wastes.map((w) => w.id)
          filterWaste(wastes, '', 'all', 'all')
          return wastes.map((w) => w.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })

  it('filtered length is always <= input length', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 10 }),
        (wastes, search) => {
          const filtered = filterWaste(wastes, search, 'all', 'all')
          return filtered.length <= wastes.length
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('WasteListPage — pagination', () => {
  it('first page starts at index 0', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: PAGE_SIZE + 1, maxLength: 100 }),
        (wastes) => {
          const paged = paginate(wastes, 1)
          return paged[0]?.id === wastes[0]?.id
        }
      ),
      { numRuns: 50 }
    )
  })

  it('page size is respected', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: PAGE_SIZE * 3, maxLength: PAGE_SIZE * 5 }),
        (wastes) => {
          const paged = paginate(wastes, 2)
          return paged.length <= PAGE_SIZE
        }
      ),
      { numRuns: 50 }
    )
  })

  it('second page starts at correct offset', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: PAGE_SIZE + 1, maxLength: 100 }),
        (wastes) => {
          const page1 = paginate(wastes, 1)
          const page2 = paginate(wastes, 2)
          if (page1.length === 0 || page2.length === 0) return true
          return page2[0]?.id === wastes[PAGE_SIZE]?.id
        }
      ),
      { numRuns: 50 }
    )
  })

  it('invalid page numbers default to page 1', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: PAGE_SIZE + 1, maxLength: 100 }),
        fc.integer({ min: -100, max: 0 }),
        (wastes, invalidPage) => {
          const paged = paginate(wastes, invalidPage)
          const page1 = paginate(wastes, 1)
          return paged[0]?.id === page1[0]?.id
        }
      ),
      { numRuns: 50 }
    )
  })

  it('last page contains fewer items if not full', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: PAGE_SIZE + 5 }),
        (wastes) => {
          const totalPages = calculateTotalPages(wastes.length)
          if (totalPages === 1) return wastes.length === paginate(wastes, 1).length
          const lastPage = paginate(wastes, totalPages)
          return lastPage.length <= PAGE_SIZE
        }
      ),
      { numRuns: 50 }
    )
  })

  it('total pages calculation is correct', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: 100 }),
        (wastes) => {
          const totalPages = calculateTotalPages(wastes.length)
          const expected = Math.max(1, Math.ceil(wastes.length / PAGE_SIZE))
          return totalPages === expected
        }
      ),
      { numRuns: 50 }
    )
  })

  it('all pages together contain all items', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: PAGE_SIZE * 5 }),
        (wastes) => {
          if (wastes.length === 0) return true
          const totalPages = calculateTotalPages(wastes.length)
          const allPaged: Material[] = []
          for (let i = 1; i <= totalPages; i++) {
            allPaged.push(...paginate(wastes, i))
          }
          return allPaged.length === wastes.length
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('WasteListPage — waste selection', () => {
  it('toggling off removes ID from selection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (id) => {
          const selected = [id]
          const result = toggleSelection(selected, id)
          return result.length === 0
        }
      ),
      { numRuns: 50 }
    )
  })

  it('toggling on adds ID to selection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (id) => {
          const selected: number[] = []
          const result = toggleSelection(selected, id)
          return result.includes(id) && result.length === 1
        }
      ),
      { numRuns: 50 }
    )
  })

  it('toggling same ID twice returns to original state', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 0, maxLength: 10 }),
        fc.integer({ min: 1, max: 100000 }),
        (selected, id) => {
          const after1 = toggleSelection(selected, id)
          const after2 = toggleSelection(after1, id)
          return selected.length === after2.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('toggle does not mutate original selection', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 0, maxLength: 10 }),
        fc.integer({ min: 1, max: 100000 }),
        (selected, id) => {
          const original = selected.length
          toggleSelection(selected, id)
          return selected.length === original
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('WasteListPage — select all on page', () => {
  it('select all adds all page IDs when not all selected', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: PAGE_SIZE }),
        (pageItems) => {
          const selected: number[] = []
          const result = selectAllOnPage(selected, pageItems, false)
          return pageItems.every((item) => result.includes(item.id))
        }
      ),
      { numRuns: 50 }
    )
  })

  it('select all removes page IDs when all selected', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: PAGE_SIZE }),
        (pageItems) => {
          const pageIds = pageItems.map((w) => w.id)
          const selected = [...pageIds]
          const result = selectAllOnPage(selected, pageItems, true)
          return !pageItems.some((item) => result.includes(item.id))
        }
      ),
      { numRuns: 50 }
    )
  })

  it('select all does not mutate original selection', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 1, maxLength: PAGE_SIZE }),
        fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 0, maxLength: 20 }),
        (pageItems, selected) => {
          const original = selected.length
          selectAllOnPage(selected, pageItems, false)
          return selected.length === original
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('WasteListPage — batch action availability', () => {
  it('confirmable items are active and not confirmed', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: 50 }),
        (wastes) => {
          const count = countSelectableByStatus(wastes, 'confirmable')
          const expected = wastes.filter((w) => w.is_active && !w.is_confirmed).length
          return count === expected
        }
      ),
      { numRuns: 50 }
    )
  })

  it('verifiable items are those not yet verified', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: 50 }),
        (wastes) => {
          const count = countSelectableByStatus(wastes, 'verifiable')
          const expected = wastes.filter((w) => !w.verified).length
          return count === expected
        }
      ),
      { numRuns: 50 }
    )
  })

  it('transferable items are all active items', () => {
    fc.assert(
      fc.property(
        fc.array(materialArb, { minLength: 0, maxLength: 50 }),
        (wastes) => {
          const count = countSelectableByStatus(wastes, 'transferable')
          const expected = wastes.filter((w) => w.is_active).length
          return count === expected
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('WasteListPage — waste type labels', () => {
  it('all waste types have valid labels', () => {
    const types = [0, 1, 2, 3, 4, 5, 6]
    types.forEach((type) => {
      const label = getWasteLabel(type)
      expect(label).not.toBe('Unknown')
    })
  })

  it('invalid types return unknown label', () => {
    const label = getWasteLabel(999)
    expect(label).toBe('Unknown')
  })

  it('labels are non-empty strings', () => {
    const types = [0, 1, 2, 3, 4, 5, 6]
    types.forEach((type) => {
      const label = getWasteLabel(type)
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    })
  })
})
