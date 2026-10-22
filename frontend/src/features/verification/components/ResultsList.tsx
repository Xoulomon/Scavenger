import { ChevronDown, ChevronUp, Filter } from 'lucide-react'

import type { Material } from '@/api/types'
import { Button } from '@/components/ui/Button'

import type { SortDirection, SortField } from '../types'
import { WasteListItem } from './WasteListItem'

export function ResultsList({
  materials,
  isLoading,
  selectedId,
  checkedIds,
  onSelect,
  onCheck,
  onSelectAll,
  sortField,
  sortDir,
  onSort,
  hasActiveFilters,
  onClearFilters,
}: {
  materials: Material[]
  isLoading: boolean
  selectedId: number | null
  checkedIds: Set<number>
  onSelect: (id: number) => void
  onCheck: (id: number, checked: boolean) => void
  onSelectAll: () => void
  sortField: SortField
  sortDir: SortDirection
  onSort: (field: SortField) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="space-y-3">
      {/* List header / sort controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={materials.length > 0 && checkedIds.size === materials.length}
            onChange={onSelectAll}
            className="h-4 w-4 rounded border"
            aria-label="Select all items"
          />
          <span className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : `${materials.length} item${materials.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Sort:</span>
          {([
            { field: 'date' as SortField, label: 'Date' },
            { field: 'id' as SortField, label: 'ID' },
            { field: 'weight' as SortField, label: 'Weight' },
          ]).map(({ field, label }) => (
            <Button
              key={field}
              variant={sortField === field ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onSort(field)}
              aria-label={`Sort by ${label}`}
              className="h-7 px-2 text-xs"
            >
              {label}
              {sortField === field && (
                sortDir === 'asc' ? (
                  <ChevronUp className="ml-0.5 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-0.5 h-3 w-3" />
                )
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-muted-foreground">
          <Filter className="h-8 w-8 opacity-30" />
          <p className="text-sm">No materials match your filters.</p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              aria-label="Clear all filters"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto pr-1" role="listbox" aria-label="Waste materials list">
          {materials.map((material) => (
            <WasteListItem
              key={material.id}
              material={material}
              isSelected={selectedId === material.id}
              isChecked={checkedIds.has(material.id)}
              onSelect={() => onSelect(material.id)}
              onCheck={(checked) => onCheck(material.id, checked)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
