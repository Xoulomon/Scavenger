import { WasteType } from '@/api/types'
import { wasteTypeLabel } from '@/lib/helpers'
import type { MapFilters } from '@/hooks/useMapData'
import { Switch } from '@/components/ui/Switch'

interface Props {
  filters: MapFilters
  onChange: (f: MapFilters) => void
}

const WASTE_TYPES = [
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass
]

export function WasteMapFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <label htmlFor="map-location-search" className="text-xs font-medium text-muted-foreground">
          Location
        </label>
        <input
          id="map-location-search"
          type="search"
          placeholder="Address, ID, or lat,lng"
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.locationQuery ?? ''}
          onChange={(e) => onChange({ ...filters, locationQuery: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="map-radius-search" className="text-xs font-medium text-muted-foreground">
          Radius
        </label>
        <input
          id="map-radius-search"
          type="number"
          min={1}
          max={500}
          className="h-8 w-20 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.radiusKm ?? 25}
          onChange={(e) =>
            onChange({
              ...filters,
              radiusKm: e.target.value ? Number(e.target.value) : undefined
            })
          }
        />
        <span className="text-xs text-muted-foreground">km</span>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="map-waste-type" className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <select
          id="map-waste-type"
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.wasteType ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              wasteType: e.target.value === '' ? undefined : (Number(e.target.value) as WasteType)
            })
          }
        >
          <option value="">All types</option>
          {WASTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {wasteTypeLabel(t)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="map-status" className="text-xs font-medium text-muted-foreground">
          Status
        </label>
        <select
          id="map-status"
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.status ?? 'all'}
          onChange={(e) => onChange({ ...filters, status: e.target.value as MapFilters['status'] })}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="map-date-from" className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          id="map-date-from"
          type="date"
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={
            filters.dateFrom ? new Date(filters.dateFrom * 1000).toISOString().slice(0, 10) : ''
          }
          onChange={(e) =>
            onChange({
              ...filters,
              dateFrom: e.target.value ? new Date(e.target.value).getTime() / 1000 : undefined
            })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="map-date-to" className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input
          id="map-date-to"
          type="date"
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.dateTo ? new Date(filters.dateTo * 1000).toISOString().slice(0, 10) : ''}
          onChange={(e) =>
            onChange({
              ...filters,
              dateTo: e.target.value ? new Date(e.target.value).getTime() / 1000 : undefined
            })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Participants</label>
        <Switch
          checked={filters.showParticipants ?? true}
          onCheckedChange={(v) => onChange({ ...filters, showParticipants: v })}
        />
      </div>
    </div>
  )
}
