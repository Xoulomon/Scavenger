// ── Analytics data shaping ────────────────────────────────────────────────────
// Chart datasets and the transforms that turn them into renderable bar widths.
// Kept separate from the chart components so they can be unit tested and later
// swapped for live contract/indexer data without touching the UI.

export interface MaterialVolume {
  label: string
  value: number
  color: string
}

export const TOP_MATERIALS: MaterialVolume[] = [
  { label: 'Plastic', value: 73, color: 'bg-blue-500' },
  { label: 'Metal', value: 51, color: 'bg-green-500' },
  { label: 'Glass', value: 42, color: 'bg-purple-500' },
  { label: 'Paper', value: 38, color: 'bg-orange-500' },
  { label: 'E-Waste', value: 22, color: 'bg-red-500' }
]

export interface ParticipantContribution {
  address: string
  role: string
  items: number
  pct: number
}

export const PARTICIPANT_CONTRIBUTIONS: ParticipantContribution[] = [
  { address: '0xAB12…CD34', role: 'Recycler', items: 142, pct: 34 },
  { address: '0xEF56…GH78', role: 'Collector', items: 98, pct: 23 },
  { address: '0xIJ90…KL12', role: 'Recycler', items: 76, pct: 18 },
  { address: '0xMN34…OP56', role: 'Manufacturer', items: 54, pct: 13 },
  { address: '0xQR78…ST90', role: 'Collector', items: 50, pct: 12 }
]

export const ROLE_COLORS: Record<string, string> = {
  Recycler: 'bg-blue-500',
  Collector: 'bg-green-500',
  Manufacturer: 'bg-purple-500'
}

/** Largest `value` in a dataset; 0 for an empty one. */
export function maxValue(items: { value: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.value), 0)
}

/** Bar width (0–100) for `value` relative to the dataset maximum. */
export function percentOfMax(value: number, max: number): number {
  if (max <= 0) return 0
  return (value / max) * 100
}

/** Tailwind color class for a participant role, with a neutral fallback. */
export function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? 'bg-primary'
}
