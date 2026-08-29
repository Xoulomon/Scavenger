import { Popup } from 'react-leaflet'
import { WasteMapPoint } from '@/hooks/useMapData'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { AddressDisplay } from '@/components/ui/AddressDisplay'

interface Props {
  point: WasteMapPoint
}

export function WasteMarkerPopup({ point }: Props) {
  const { waste } = point
  const weightKg = (Number(waste.weight) / 1000).toFixed(2)

  const statusLabel = !waste.is_active ? 'Inactive' : waste.is_confirmed ? 'Confirmed' : 'Pending'
  const statusClass = !waste.is_active
    ? 'bg-muted text-muted-foreground border-border'
    : waste.is_confirmed
      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'

  return (
    <Popup>
      <div className="min-w-[180px] space-y-2 p-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{wasteTypeLabel(waste.waste_type)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <div>Weight: <span className="font-medium text-foreground">{weightKg} kg</span></div>
          <div>ID: <span className="font-medium text-foreground">#{String(waste.waste_id)}</span></div>
          <div>Date: <span className="font-medium text-foreground">{formatDate(waste.recycled_timestamp)}</span></div>
        </div>
        <div className="text-xs text-muted-foreground">
          Owner: <AddressDisplay address={waste.current_owner} className="inline text-xs" />
        </div>
      </div>
    </Popup>
  )
}
