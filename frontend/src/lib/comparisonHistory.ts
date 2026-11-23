import type { Waste } from '@/api/types'

export interface ComparisonSnapshot {
  id: string
  timestamp: number
  wasteIds: string[]
  label: string
}

const KEY = 'scavngr_comparison_history'
const MAX = 10

export function getComparisonHistory(): ComparisonSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ComparisonSnapshot[]) : []
  } catch {
    return []
  }
}

export function saveComparison(wastes: Waste[]): void {
  if (wastes.length < 2) return
  const snapshot: ComparisonSnapshot = {
    id: `cmp_${Date.now()}`,
    timestamp: Date.now(),
    wasteIds: wastes.map((w) => String(w.waste_id)),
    label: wastes.map((w) => `#${String(w.waste_id)}`).join(' vs ')
  }
  const history = getComparisonHistory().filter((s) => s.label !== snapshot.label)
  history.unshift(snapshot)
  if (history.length > MAX) history.splice(MAX)
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function deleteComparison(id: string): void {
  const history = getComparisonHistory().filter((s) => s.id !== id)
  localStorage.setItem(KEY, JSON.stringify(history))
}
