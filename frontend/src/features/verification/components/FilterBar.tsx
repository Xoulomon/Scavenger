import { Search, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

import { WASTE_TYPE_OPTIONS } from '../constants'
import type { StatusFilter } from '../types'

export function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  wasteTypeFilter,
  onWasteTypeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  showFilters,
  onToggleFilters,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: StatusFilter
  onStatusChange: (s: StatusFilter) => void
  wasteTypeFilter: string
  onWasteTypeChange: (t: string) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (d: string) => void
  onDateToChange: (d: string) => void
  showFilters: boolean
  onToggleFilters: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID or submitter..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search waste items"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </Button>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Waste Type</label>
            <select
              value={wasteTypeFilter}
              onChange={(e) => onWasteTypeChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by waste type"
            >
              <option value="all">All Types</option>
              {WASTE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-9"
              aria-label="Filter from date"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-9"
              aria-label="Filter to date"
            />
          </div>
        </div>
      )}
    </div>
  )
}
