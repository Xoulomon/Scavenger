import { lazy, Suspense, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useMapData } from '@/hooks/useMapData'
import type { MapFilters } from '@/hooks/useMapData'
import { WasteMapFilters } from '@/components/map/WasteMapFilters'

const WasteMap = lazy(() => import('@/components/map/WasteMap').then((m) => ({ default: m.WasteMap })))

// Reserves the map's height while the Leaflet chunk loads so the page does not shift when it appears.
function MapPlaceholder() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      className="flex h-full min-h-[320px] w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground"
    >
      Loading map...
    </div>
  )
}

export function WasteMapPage() {
  useAppTitle('Waste Map')
  const [filters, setFilters] = useState<MapFilters>({ showParticipants: true, radiusKm: 25 })
  const { wastes, participants, isLoading } = useMapData(filters)
  const hasLocations = wastes.length > 0 || participants.length > 0

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MapPin className="h-6 w-6 text-primary" />
          Waste Map
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {wastes.length} waste item{wastes.length !== 1 ? 's' : ''} - {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </p>
      </div>

      <WasteMapFilters filters={filters} onChange={setFilters} />

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading map data...
            </div>
          </div>
        )}
        {!isLoading && !hasLocations && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-lg border bg-background/95 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            No waste locations match the current filters.
          </div>
        )}
        <Suspense fallback={<MapPlaceholder />}>
          <WasteMap wastes={wastes} participants={participants} className="h-full w-full" />
        </Suspense>
      </div>
    </div>
  )
}
