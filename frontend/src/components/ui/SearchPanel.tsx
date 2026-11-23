import React, { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, X, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'
import { getFilterPresets, saveFilterPreset, deleteFilterPreset } from '@/lib/searchStorage'
import type { SearchFilters, FilterPreset } from '@/lib/searchStorage'
import { WasteType } from '@/api/types'

// ─── Default filter state ────────────────────────────────────────────────────

export const DEFAULT_FILTERS: SearchFilters = {
  wasteTypes: [],
  status: 'all',
  dateFrom: null,
  dateTo: null,
  location: ''
}

// ─── Pure helper: count active filters ───────────────────────────────────────

/**
 * Returns the number of filter fields that differ from their default values.
 * This is a pure function — no side effects, no React hooks.
 */
export function countActiveFilters(filters: SearchFilters): number {
  let count = 0
  if (filters.wasteTypes.length > 0) count++
  if (filters.status !== DEFAULT_FILTERS.status) count++
  if (filters.dateFrom !== null) count++
  if (filters.dateTo !== null) count++
  if (filters.location.trim() !== '') count++
  return count
}

// ─── Waste type options ───────────────────────────────────────────────────────

const WASTE_TYPE_OPTIONS: { value: WasteType; label: string }[] = [
  { value: WasteType.Paper, label: 'Paper' },
  { value: WasteType.PetPlastic, label: 'PET Plastic' },
  { value: WasteType.Plastic, label: 'Plastic' },
  { value: WasteType.Metal, label: 'Metal' },
  { value: WasteType.Glass, label: 'Glass' }
]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SearchPanelProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchPanel({ filters, onChange }: SearchPanelProps) {
  const [open, setOpen] = useState(false)
  const [presets, setPresets] = useState<FilterPreset[]>(() => getFilterPresets())
  const [presetName, setPresetName] = useState('')
  const [showPresetInput, setShowPresetInput] = useState(false)

  const activeCount = countActiveFilters(filters)

  // ── Toggle waste type ──────────────────────────────────────────────────────
  const toggleWasteType = useCallback(
    (wt: WasteType) => {
      const next = filters.wasteTypes.includes(wt)
        ? filters.wasteTypes.filter((t) => t !== wt)
        : [...filters.wasteTypes, wt]
      onChange({ ...filters, wasteTypes: next })
    },
    [filters, onChange]
  )

  // ── Clear all ──────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    onChange({ ...DEFAULT_FILTERS })
  }, [onChange])

  // ── Save preset ───────────────────────────────────────────────────────────
  const handleSavePreset = useCallback(() => {
    const name = presetName.trim()
    if (!name) return
    const preset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name,
      filters: { ...filters }
    }
    saveFilterPreset(preset)
    const updated = getFilterPresets()
    setPresets(updated)
    setPresetName('')
    setShowPresetInput(false)
  }, [presetName, filters])

  // ── Delete preset ─────────────────────────────────────────────────────────
  const handleDeletePreset = useCallback((id: string) => {
    deleteFilterPreset(id)
    setPresets(getFilterPresets())
  }, [])

  // ── Apply preset ──────────────────────────────────────────────────────────
  const handleApplyPreset = useCallback(
    (preset: FilterPreset) => {
      onChange({ ...preset.filters })
    },
    [onChange]
  )

  return (
    <div className="w-full">
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="search-panel"
        className="flex items-center gap-2"
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Advanced Filters
        {activeCount > 0 && (
          <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* Collapsible panel */}
      {open && (
        <div
          id="search-panel"
          className="mt-2 rounded-lg border bg-card p-4 shadow-sm"
          data-testid="search-panel"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* WasteType multi-select */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Waste Type</legend>
              <div className="space-y-1">
                {WASTE_TYPE_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.wasteTypes.includes(value)}
                      onChange={() => toggleWasteType(value)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Status select */}
            <div className="space-y-2">
              <label htmlFor="filter-status" className="text-sm font-medium">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(v) =>
                  onChange({
                    ...filters,
                    status: v as SearchFilters['status']
                  })
                }
              >
                <SelectTrigger id="filter-status" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Date Range</span>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-date-from" className="sr-only">
                  From date
                </label>
                <Input
                  id="filter-date-from"
                  type="date"
                  placeholder="From"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
                  className="h-9"
                />
                <label htmlFor="filter-date-to" className="sr-only">
                  To date
                </label>
                <Input
                  id="filter-date-to"
                  type="date"
                  placeholder="To"
                  value={filters.dateTo ?? ''}
                  onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
                  className="h-9"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label htmlFor="filter-location" className="text-sm font-medium">
                Location
              </label>
              <Input
                id="filter-location"
                type="text"
                placeholder="Enter location…"
                value={filters.location}
                onChange={(e) => onChange({ ...filters, location: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          {/* Actions row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="flex items-center gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </Button>

            {!showPresetInput ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPresetInput(true)}
                className="flex items-center gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                Save as preset
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  placeholder="Preset name…"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePreset()
                    if (e.key === 'Escape') {
                      setShowPresetInput(false)
                      setPresetName('')
                    }
                  }}
                  className="h-8 w-40 text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPresetInput(false)
                    setPresetName('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Saved presets */}
          {presets.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Saved presets</p>
              <ul className="space-y-1">
                {presets.map((preset) => (
                  <li
                    key={preset.id}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2 py-1',
                      'border border-transparent hover:border-border hover:bg-accent'
                    )}
                  >
                    <button
                      className="flex-1 text-left text-sm"
                      onClick={() => handleApplyPreset(preset)}
                    >
                      {preset.name}
                    </button>
                    <button
                      aria-label={`Delete preset ${preset.name}`}
                      onClick={() => handleDeletePreset(preset.id)}
                      className="ml-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
