import type { Incentive, WasteType } from '@/api/types'

export type SortField = 'reward_points' | 'remaining_budget' | 'waste_type'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list'

export interface IncentiveFilters {
  wasteTypes: WasteType[]
  rewarder: string
}

export const VIEW_STORAGE_KEY = 'scavngr_incentives_view'

/**
 * Sort a list of incentives by the given field and direction.
 * Returns a new array — does not mutate the input.
 */
export function sortIncentives(
  incentives: Incentive[],
  field: SortField,
  dir: SortDir
): Incentive[] {
  const sorted = [...incentives].sort((a, b) => {
    let cmp = 0
    if (field === 'reward_points') {
      cmp = Number(a.reward_points) - Number(b.reward_points)
    } else if (field === 'remaining_budget') {
      cmp = Number(a.remaining_budget) - Number(b.remaining_budget)
    } else {
      // waste_type — numeric enum
      cmp = a.waste_type - b.waste_type
    }
    return dir === 'asc' ? cmp : -cmp
  })
  return sorted
}

/**
 * Filter a list of incentives by the given filters.
 * Returns a new array — does not mutate the input.
 */
export function filterIncentives(incentives: Incentive[], filters: IncentiveFilters): Incentive[] {
  return incentives.filter((inc) => {
    if (filters.wasteTypes.length > 0 && !filters.wasteTypes.includes(inc.waste_type)) {
      return false
    }
    if (
      filters.rewarder.trim() !== '' &&
      !inc.rewarder.toLowerCase().includes(filters.rewarder.trim().toLowerCase())
    ) {
      return false
    }
    return true
  })
}

/** Read view mode from localStorage, defaulting to 'grid'. */
export function readViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'grid' || stored === 'list') return stored
  } catch {
    // ignore
  }
  return 'grid'
}

/** Persist view mode to localStorage. */
export function writeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

// ─── Comparison helpers ───────────────────────────────────────────────────────

export const MAX_COMPARE = 3

/**
 * Toggle an incentive ID in the comparison set.
 * Enforces a cap of MAX_COMPARE — attempting to add a 4th leaves the set unchanged.
 * Returns a new Set — does not mutate the input.
 */
export function toggleCompareId(current: Set<number>, id: number): Set<number> {
  if (current.has(id)) {
    const next = new Set(current)
    next.delete(id)
    return next
  }
  if (current.size >= MAX_COMPARE) return current
  return new Set([...current, id])
}
