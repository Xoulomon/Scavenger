import type { WasteType } from '../api/types'

export interface SearchFilters {
  wasteTypes: WasteType[]
  status: 'all' | 'active' | 'confirmed' | 'inactive'
  dateFrom: string | null
  dateTo: string | null
  location: string
}

export interface FilterPreset {
  id: string
  name: string
  filters: SearchFilters
}

export interface SearchResult {
  type: 'waste' | 'participant'
  id: string
  label: string
  sublabel: string
  data: unknown
}

const HISTORY_KEY = 'scavngr_search_history'
const PRESETS_KEY = 'scavngr_filter_presets'
const MAX_HISTORY = 20

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addSearchHistory(query: string): void {
  const trimmed = query.trim()
  if (!trimmed) return
  const history = getSearchHistory().filter((q) => q !== trimmed)
  history.unshift(trimmed)
  if (history.length > MAX_HISTORY) {
    history.splice(MAX_HISTORY)
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getFilterPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    return raw ? (JSON.parse(raw) as FilterPreset[]) : []
  } catch {
    return []
  }
}

export function saveFilterPreset(preset: FilterPreset): void {
  const presets = getFilterPresets().filter((p) => p.id !== preset.id)
  presets.push(preset)
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

export function deleteFilterPreset(id: string): void {
  const presets = getFilterPresets().filter((p) => p.id !== id)
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

// ─── URL serialisation ────────────────────────────────────────────────────────

/**
 * Serialises a query string and SearchFilters into URLSearchParams.
 * Only non-default values are written to keep URLs short.
 */
export function filtersToSearchParams(query: string, filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (query) params.set('q', query)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.wasteTypes.length > 0) params.set('wasteTypes', filters.wasteTypes.join(','))
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.location.trim()) params.set('location', filters.location)

  return params
}

/**
 * Parses URLSearchParams back into a query string and SearchFilters.
 * Missing or invalid values fall back to defaults.
 */
export function searchParamsToFilters(params: URLSearchParams): {
  query: string
  filters: SearchFilters
} {
  const query = params.get('q') ?? ''

  const rawStatus = params.get('status')
  const validStatuses = ['all', 'active', 'confirmed', 'inactive'] as const
  const status: SearchFilters['status'] = validStatuses.includes(
    rawStatus as SearchFilters['status']
  )
    ? (rawStatus as SearchFilters['status'])
    : 'all'

  const rawWasteTypes = params.get('wasteTypes')
  const wasteTypes: WasteType[] = rawWasteTypes
    ? (rawWasteTypes
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 0 && n <= 4) as WasteType[])
    : []

  const dateFrom = params.get('dateFrom') || null
  const dateTo = params.get('dateTo') || null
  const location = params.get('location') ?? ''

  return {
    query,
    filters: { wasteTypes, status, dateFrom, dateTo, location }
  }
}
