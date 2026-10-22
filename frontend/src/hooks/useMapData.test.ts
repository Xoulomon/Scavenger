import { describe, expect, it } from 'vitest'
import { WasteType, Role } from '@/api/types'
import type { WasteMapPoint, ParticipantMapPoint } from '@/hooks/useMapData'
import {
  decodeCoord,
  distanceKm,
  isValidCoord,
  parseCoordinateSearch,
  participantMatchesLocationSearch,
  wasteMatchesLocationSearch,
} from '@/hooks/useMapData'

const wastePoint: WasteMapPoint = {
  id: '42',
  lat: 40.7128,
  lng: -74.006,
  waste: {
    waste_id: 42n,
    waste_type: WasteType.Plastic,
    weight: 5000n,
    current_owner: 'GOWNER123',
    latitude: 407128000n,
    longitude: -740060000n,
    recycled_timestamp: 1700000000,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
  },
}

const participantPoint: ParticipantMapPoint = {
  id: 'GPARTICIPANT123',
  lat: 40.7306,
  lng: -73.9352,
  participant: {
    address: 'GPARTICIPANT123',
    role: Role.Recycler,
    name: 'Downtown Recycler',
    latitude: 407306000,
    longitude: -739352000,
    registered_at: 1700000000,
  },
}

describe('map data helpers', () => {
  it('decodes scaled on-chain coordinates', () => {
    expect(decodeCoord(407128000n)).toBe(40.7128)
  })

  it('rejects invalid coordinates', () => {
    expect(isValidCoord(91, 0)).toBe(false)
    expect(isValidCoord(0, 0)).toBe(false)
    expect(isValidCoord(40.7128, -74.006)).toBe(true)
  })

  it('parses coordinate search input', () => {
    expect(parseCoordinateSearch('40.7128,-74.006')).toEqual([40.7128, -74.006])
    expect(parseCoordinateSearch('not a coordinate')).toBeNull()
  })

  it('calculates nearby distances in kilometers', () => {
    expect(distanceKm([40.7128, -74.006], [40.7306, -73.9352])).toBeLessThan(7)
  })

  it('matches waste by nearby coordinate search', () => {
    expect(wasteMatchesLocationSearch(wastePoint, { locationQuery: '40.713,-74.006', radiusKm: 1 })).toBe(true)
    expect(wasteMatchesLocationSearch(wastePoint, { locationQuery: '34.0522,-118.2437', radiusKm: 10 })).toBe(false)
  })

  it('matches waste by owner or id text', () => {
    expect(wasteMatchesLocationSearch(wastePoint, { locationQuery: 'owner123' })).toBe(true)
    expect(wasteMatchesLocationSearch(wastePoint, { locationQuery: '42' })).toBe(true)
  })

  it('matches participants by nearby coordinates and text', () => {
    expect(participantMatchesLocationSearch(participantPoint, { locationQuery: '40.73,-73.93', radiusKm: 2 })).toBe(true)
    expect(participantMatchesLocationSearch(participantPoint, { locationQuery: 'downtown' })).toBe(true)
    expect(participantMatchesLocationSearch(participantPoint, { locationQuery: 'collector' })).toBe(false)
  })
})

