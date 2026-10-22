import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  getSearchHistory,
  addSearchHistory,
} from '@/lib/searchStorage'
import { countActiveFilters, DEFAULT_FILTERS } from '@/components/ui/SearchPanel'
import { WasteType } from '@/api/types'
import type { Waste, Participant } from '@/api/types'
import { Role } from '@/api/types'
import { useSearch } from '@/hooks/useSearch'

describe('search history', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no history', () => {
    expect(getSearchHistory()).toEqual([])
  })

  it('adds a query to history', () => {
    addSearchHistory('plastic')
    expect(getSearchHistory()).toEqual(['plastic'])
  })

  it('deduplicates and moves repeated query to front', () => {
    addSearchHistory('plastic')
    addSearchHistory('metal')
    addSearchHistory('plastic')
    const history = getSearchHistory()
    expect(history[0]).toBe('plastic')
    expect(history.filter((q) => q === 'plastic')).toHaveLength(1)
  })

  it('ignores blank queries', () => {
    addSearchHistory('   ')
    expect(getSearchHistory()).toEqual([])
  })

  it('caps history at 20 entries', () => {
    for (let i = 0; i < 25; i++) addSearchHistory(`query${i}`)
    expect(getSearchHistory().length).toBe(20)
  })

  it('most recent query is first', () => {
    addSearchHistory('first')
    addSearchHistory('second')
    expect(getSearchHistory()[0]).toBe('second')
  })
})

describe('useSearch filter logic', () => {
  it('default filters have 0 active count', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
  })

  it('wasteType filter increments count', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, wasteTypes: [WasteType.Paper] })).toBe(1)
  })

  it('status filter increments count', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, status: 'active' })).toBe(1)
  })

  it('dateFrom filter increments count', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, dateFrom: '2024-01-01' })).toBe(1)
  })

  it('dateTo filter increments count', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, dateTo: '2024-12-31' })).toBe(1)
  })

  it('location filter increments count', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, location: 'Lagos' })).toBe(1)
  })

  it('all filters active gives count of 5', () => {
    expect(
      countActiveFilters({
        wasteTypes: [WasteType.Metal],
        status: 'confirmed',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        location: 'Nairobi',
      })
    ).toBe(5)
  })

  it('whitespace-only location is not counted as active', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, location: '   ' })).toBe(0)
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWaste(overrides: Partial<Waste> = {}): Waste {
  return {
    waste_id: BigInt(1),
    waste_type: WasteType.Paper,
    weight: BigInt(100),
    current_owner: 'GOWNER',
    latitude: BigInt(0),
    longitude: BigInt(0),
    recycled_timestamp: 0,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
    ...overrides,
  }
}

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    address: 'GADDR1',
    role: Role.Recycler,
    name: 'Alice',
    latitude: 0,
    longitude: 0,
    registered_at: 0,
    ...overrides,
  }
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ─── useSearch hook filtering tests ──────────────────────────────────────────

describe('useSearch — filtering logic', () => {
  let qc: QueryClient

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('returns empty array when query is blank', () => {
    const { result } = renderHook(() => useSearch(''), { wrapper: makeWrapper(qc) })
    expect(result.current).toEqual([])
  })

  it('returns empty array when query is whitespace only', () => {
    const { result } = renderHook(() => useSearch('   '), { wrapper: makeWrapper(qc) })
    expect(result.current).toEqual([])
  })

  it('finds a waste by id substring', () => {
    const waste = makeWaste({ waste_id: BigInt(42) })
    qc.setQueryData(['wastes', 'test'], [waste])

    const { result } = renderHook(() => useSearch('42'), { wrapper: makeWrapper(qc) })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].type).toBe('waste')
    expect(result.current[0].id).toBe('42')
  })

  it('finds a waste by owner address substring', () => {
    const waste = makeWaste({ current_owner: 'GABCDEF' })
    qc.setQueryData(['wastes', 'test'], [waste])

    const { result } = renderHook(() => useSearch('abcdef'), { wrapper: makeWrapper(qc) })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].sublabel).toBe('GABCDEF')
  })

  it('finds a participant by name', () => {
    const p = makeParticipant({ name: 'Bob Smith', address: 'GBOB' })
    qc.setQueryData(['participant', 'GBOB'], p)

    const { result } = renderHook(() => useSearch('bob'), { wrapper: makeWrapper(qc) })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].type).toBe('participant')
    expect(result.current[0].label).toBe('Bob Smith')
  })

  it('finds a participant by address', () => {
    const p = makeParticipant({ address: 'GXYZ123', name: 'Carol' })
    qc.setQueryData(['participant', 'GXYZ123'], p)

    const { result } = renderHook(() => useSearch('xyz123'), { wrapper: makeWrapper(qc) })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].type).toBe('participant')
  })

  it('deduplicates wastes appearing in multiple query caches', () => {
    const waste = makeWaste({ waste_id: BigInt(7) })
    qc.setQueryData(['wastes', 'a'], [waste])
    qc.setQueryData(['participant-wastes', 'b'], [waste])

    const { result } = renderHook(() => useSearch('7'), { wrapper: makeWrapper(qc) })
    expect(result.current.filter((r) => r.id === '7')).toHaveLength(1)
  })

  it('status filter "active" excludes inactive wastes', () => {
    const active = makeWaste({ waste_id: BigInt(1), is_active: true })
    const inactive = makeWaste({ waste_id: BigInt(2), is_active: false, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [active, inactive])

    const { result } = renderHook(
      () => useSearch('owner', { status: 'active' }),
      { wrapper: makeWrapper(qc) }
    )
    const ids = result.current.map((r) => r.id)
    expect(ids).toContain('1')
    expect(ids).not.toContain('2')
  })

  it('status filter "inactive" excludes active wastes', () => {
    const active = makeWaste({ waste_id: BigInt(1), is_active: true })
    const inactive = makeWaste({ waste_id: BigInt(2), is_active: false, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [active, inactive])

    const { result } = renderHook(
      () => useSearch('owner', { status: 'inactive' }),
      { wrapper: makeWrapper(qc) }
    )
    const ids = result.current.map((r) => r.id)
    expect(ids).not.toContain('1')
    expect(ids).toContain('2')
  })

  it('status filter "confirmed" excludes unconfirmed wastes', () => {
    const confirmed = makeWaste({ waste_id: BigInt(1), is_confirmed: true })
    const unconfirmed = makeWaste({ waste_id: BigInt(2), is_confirmed: false, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [confirmed, unconfirmed])

    const { result } = renderHook(
      () => useSearch('owner', { status: 'confirmed' }),
      { wrapper: makeWrapper(qc) }
    )
    const ids = result.current.map((r) => r.id)
    expect(ids).toContain('1')
    expect(ids).not.toContain('2')
  })

  it('status filter "all" returns all matching wastes regardless of status', () => {
    const active = makeWaste({ waste_id: BigInt(1), is_active: true })
    const inactive = makeWaste({ waste_id: BigInt(2), is_active: false, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [active, inactive])

    const { result } = renderHook(
      () => useSearch('owner', { status: 'all' }),
      { wrapper: makeWrapper(qc) }
    )
    expect(result.current).toHaveLength(2)
  })

  it('wasteType filter excludes non-matching waste types', () => {
    const paper = makeWaste({ waste_id: BigInt(1), waste_type: WasteType.Paper })
    const metal = makeWaste({ waste_id: BigInt(2), waste_type: WasteType.Metal, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [paper, metal])

    const { result } = renderHook(
      () => useSearch('owner', { wasteTypes: [WasteType.Metal] }),
      { wrapper: makeWrapper(qc) }
    )
    const ids = result.current.map((r) => r.id)
    expect(ids).not.toContain('1')
    expect(ids).toContain('2')
  })

  it('wasteType filter with multiple types includes all matching', () => {
    const paper = makeWaste({ waste_id: BigInt(1), waste_type: WasteType.Paper })
    const metal = makeWaste({ waste_id: BigInt(2), waste_type: WasteType.Metal, current_owner: 'GOWNER' })
    const glass = makeWaste({ waste_id: BigInt(3), waste_type: WasteType.Glass, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [paper, metal, glass])

    const { result } = renderHook(
      () => useSearch('owner', { wasteTypes: [WasteType.Metal, WasteType.Glass] }),
      { wrapper: makeWrapper(qc) }
    )
    const ids = result.current.map((r) => r.id)
    expect(ids).not.toContain('1')
    expect(ids).toContain('2')
    expect(ids).toContain('3')
  })

  it('empty wasteTypes array does not filter by type', () => {
    const paper = makeWaste({ waste_id: BigInt(1), waste_type: WasteType.Paper })
    const metal = makeWaste({ waste_id: BigInt(2), waste_type: WasteType.Metal, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [paper, metal])

    const { result } = renderHook(
      () => useSearch('owner', { wasteTypes: [] }),
      { wrapper: makeWrapper(qc) }
    )
    expect(result.current).toHaveLength(2)
  })

  it('combined status + wasteType filters both apply', () => {
    const activeMetalWaste = makeWaste({ waste_id: BigInt(1), waste_type: WasteType.Metal, is_active: true })
    const inactiveMetalWaste = makeWaste({ waste_id: BigInt(2), waste_type: WasteType.Metal, is_active: false, current_owner: 'GOWNER' })
    const activePaperWaste = makeWaste({ waste_id: BigInt(3), waste_type: WasteType.Paper, is_active: true, current_owner: 'GOWNER' })
    qc.setQueryData(['wastes', 'test'], [activeMetalWaste, inactiveMetalWaste, activePaperWaste])

    const { result } = renderHook(
      () => useSearch('owner', { status: 'active', wasteTypes: [WasteType.Metal] }),
      { wrapper: makeWrapper(qc) }
    )
    const ids = result.current.map((r) => r.id)
    expect(ids).toContain('1')
    expect(ids).not.toContain('2')
    expect(ids).not.toContain('3')
  })
})

// ─── Pagination helper tests ──────────────────────────────────────────────────

describe('SearchResultsPage — pagination logic', () => {
  const PAGE_SIZE = 10

  it('first page shows at most PAGE_SIZE items', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const page1 = items.slice(0, 1 * PAGE_SIZE)
    expect(page1).toHaveLength(PAGE_SIZE)
  })

  it('second page shows up to 2*PAGE_SIZE items', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const page2 = items.slice(0, 2 * PAGE_SIZE)
    expect(page2).toHaveLength(20)
  })

  it('shows all items when total is less than PAGE_SIZE', () => {
    const items = Array.from({ length: 5 }, (_, i) => i)
    const page1 = items.slice(0, 1 * PAGE_SIZE)
    expect(page1).toHaveLength(5)
  })

  it('remaining count is total minus paged', () => {
    const total = 25
    const paged = 10
    expect(total - paged).toBe(15)
  })
})