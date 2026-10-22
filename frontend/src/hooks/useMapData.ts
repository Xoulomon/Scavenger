import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { WasteType } from '@/api/types'
import type { Waste, Participant } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'

export interface MapFilters {
  wasteType?: WasteType
  status?: 'all' | 'active' | 'confirmed' | 'pending'
  dateFrom?: number
  dateTo?: number
  locationQuery?: string
  radiusKm?: number
  showParticipants?: boolean
}

export interface WasteMapPoint {
  id: string
  lat: number
  lng: number
  waste: Waste
}

export interface ParticipantMapPoint {
  id: string
  lat: number
  lng: number
  participant: Participant
}

/** Coordinates are stored as i128 scaled by 1e7 (microdegrees * 10). */
export function decodeCoord(raw: bigint): number {
  return Number(raw) / 1e7
}

export function isValidCoord(lat: number, lng: number): boolean {
  return (
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

export function parseCoordinateSearch(query?: string): [number, number] | null {
  const normalized = query?.trim()
  if (!normalized) return null

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null

  const lat = Number(match[1])
  const lng = Number(match[2])
  return isValidCoord(lat, lng) ? [lat, lng] : null
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h))
}

function normalizeSearch(value?: string): string {
  return value?.trim().toLowerCase() ?? ''
}

export function wasteMatchesLocationSearch(point: WasteMapPoint, filters?: MapFilters): boolean {
  const query = normalizeSearch(filters?.locationQuery)
  if (!query) return true

  const coordinateSearch = parseCoordinateSearch(query)
  if (coordinateSearch) {
    return distanceKm([point.lat, point.lng], coordinateSearch) <= (filters?.radiusKm ?? 25)
  }

  const haystack = [
    point.id,
    String(point.waste.waste_id),
    point.waste.current_owner,
    point.lat.toFixed(4),
    point.lng.toFixed(4),
  ].join(' ').toLowerCase()

  return haystack.includes(query)
}

export function participantMatchesLocationSearch(point: ParticipantMapPoint, filters?: MapFilters): boolean {
  const query = normalizeSearch(filters?.locationQuery)
  if (!query) return true

  const coordinateSearch = parseCoordinateSearch(query)
  if (coordinateSearch) {
    return distanceKm([point.lat, point.lng], coordinateSearch) <= (filters?.radiusKm ?? 25)
  }

  const haystack = [
    point.id,
    point.participant.address,
    point.participant.name,
    point.participant.role,
    point.lat.toFixed(4),
    point.lng.toFixed(4),
  ].join(' ').toLowerCase()

  return haystack.includes(query)
}

export function useMapData(filters?: MapFilters) {
  const { address } = useWallet()
  const { config } = useContract()

  const { data: wastes = [], isLoading: wastesLoading } = useQuery<WasteMapPoint[]>({
    queryKey: cacheKeys.mapWastes(address, filters),
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(ids.map((id) => client.getWaste(id)))
      let items = results.filter((w): w is Waste => w !== null)

      // Apply filters
      if (filters?.wasteType !== undefined) {
        items = items.filter((w) => w.waste_type === filters.wasteType)
      }
      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'active') items = items.filter((w) => w.is_active)
        if (filters.status === 'confirmed') items = items.filter((w) => w.is_confirmed)
        if (filters.status === 'pending') items = items.filter((w) => w.is_active && !w.is_confirmed)
      }
      if (filters?.dateFrom) {
        items = items.filter((w) => w.recycled_timestamp >= (filters.dateFrom ?? 0))
      }
      if (filters?.dateTo) {
        items = items.filter((w) => w.recycled_timestamp <= (filters.dateTo ?? Infinity))
      }

      return items
        .map((w) => {
          const lat = decodeCoord(w.latitude)
          const lng = decodeCoord(w.longitude)
          return { id: String(w.waste_id), lat, lng, waste: w }
        })
        .filter((p) => isValidCoord(p.lat, p.lng))
        .filter((p) => wasteMatchesLocationSearch(p, filters))
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000,
  })

  const { data: participants = [], isLoading: participantsLoading } = useQuery<ParticipantMapPoint[]>({
    queryKey: cacheKeys.mapParticipant(address, filters),
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const p = await client.getParticipant(address)
      if (!p) return []
      const lat = Number(p.latitude) / 1e7
      const lng = Number(p.longitude) / 1e7
      if (!isValidCoord(lat, lng)) return []
      const point = { id: p.address, lat, lng, participant: p }
      return participantMatchesLocationSearch(point, filters) ? [point] : []
    },
    enabled: !!address && (filters?.showParticipants ?? true),
    staleTime: 5 * 60 * 1000,
  })

  return {
    wastes,
    participants,
    isLoading: wastesLoading || participantsLoading,
  }
}
