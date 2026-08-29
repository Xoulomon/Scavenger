import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-markercluster'
import type { WasteMapPoint, ParticipantMapPoint } from '@/hooks/useMapData'
import { WasteType, Role } from '@/api/types'
import { wasteTypeLabel, formatDate, roleLabel } from '@/lib/helpers'
import { AddressDisplay } from '@/components/ui/AddressDisplay'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const WASTE_COLORS: Record<WasteType, string> = {
  [WasteType.Paper]: '#ca8a04',
  [WasteType.PetPlastic]: '#2563eb',
  [WasteType.Plastic]: '#9333ea',
  [WasteType.Metal]: '#64748b',
  [WasteType.Glass]: '#0891b2',
  [WasteType.Organic]: '#16a34a',
  [WasteType.Electronic]: '#dc2626',
}

const WASTE_MARKERS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Pa',
  [WasteType.PetPlastic]: 'PET',
  [WasteType.Plastic]: 'Pl',
  [WasteType.Metal]: 'Me',
  [WasteType.Glass]: 'Gl',
  [WasteType.Organic]: 'Or',
  [WasteType.Electronic]: 'El',
}

function makeWasteIcon(type: WasteType, confirmed: boolean, active: boolean): L.DivIcon {
  const color = active ? WASTE_COLORS[type] : '#94a3b8'
  const label = WASTE_MARKERS[type]
  const ring = confirmed ? 'box-shadow:0 0 0 2px #22c55e,0 2px 6px rgba(0,0,0,.3)' : 'box-shadow:0 2px 6px rgba(0,0,0,.3)'

  return L.divIcon({
    className: '',
    html: `<div aria-hidden="true" style="background:${color};${ring};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;border:2px solid white">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

function makeParticipantIcon(role: Role): L.DivIcon {
  const roleColors: Record<Role, string> = {
    [Role.Recycler]: '#16a34a',
    [Role.Collector]: '#d97706',
    [Role.Manufacturer]: '#7c3aed',
  }
  const roleLabels: Record<Role, string> = {
    [Role.Recycler]: 'R',
    [Role.Collector]: 'C',
    [Role.Manufacturer]: 'M',
  }
  const color = roleColors[role] ?? '#64748b'
  const label = roleLabels[role] ?? 'P'

  return L.divIcon({
    className: '',
    html: `<div aria-hidden="true" style="background:${color};box-shadow:0 2px 8px rgba(0,0,0,.35);width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;border:2px solid white">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
  }, [map, points])

  return null
}

interface WasteMapProps {
  wastes: WasteMapPoint[]
  participants: ParticipantMapPoint[]
  className?: string
}

export function WasteMap({ wastes, participants, className }: WasteMapProps) {
  const allPoints: [number, number][] = [
    ...wastes.map((w) => [w.lat, w.lng] as [number, number]),
    ...participants.map((p) => [p.lat, p.lng] as [number, number]),
  ]
  const defaultCenter: [number, number] = [20, 0]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={2}
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {allPoints.length > 0 && <FitBounds points={allPoints} />}

      <MarkerClusterGroup chunkedLoading>
        {wastes.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={makeWasteIcon(point.waste.waste_type, point.waste.is_confirmed, point.waste.is_active)}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{wasteTypeLabel(point.waste.waste_type)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      !point.waste.is_active
                        ? 'bg-gray-100 text-gray-600'
                        : point.waste.is_confirmed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {!point.waste.is_active ? 'Inactive' : point.waste.is_confirmed ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
                <div className="space-y-0.5 text-xs text-gray-500">
                  <div>
                    Weight: <b className="text-gray-800">{(Number(point.waste.weight) / 1000).toFixed(2)} kg</b>
                  </div>
                  <div>
                    ID: <b className="text-gray-800">#{String(point.waste.waste_id)}</b>
                  </div>
                  <div>
                    Date: <b className="text-gray-800">{formatDate(point.waste.recycled_timestamp)}</b>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Owner: <AddressDisplay address={point.waste.current_owner} />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

      {participants.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={makeParticipantIcon(point.participant.role)}
        >
          <Popup>
            <div className="min-w-[160px] space-y-1.5 text-sm">
              <div className="font-semibold">{point.participant.name || 'Participant'}</div>
              <div className="text-xs text-gray-500">
                Role: <b className="text-gray-800">{roleLabel(point.participant.role)}</b>
              </div>
              <div className="text-xs text-gray-500">
                Address: <AddressDisplay address={point.participant.address} />
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
