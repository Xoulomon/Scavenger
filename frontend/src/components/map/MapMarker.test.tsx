import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WasteMap } from './WasteMap'
import { WasteType, Role } from '@/api/types'
import type { WasteMapPoint, ParticipantMapPoint } from '@/hooks/useMapData'
import { vi } from 'vitest'

vi.mock('@/config', () => ({ config: { network: 'TESTNET' } }))

const mockWastePoints: WasteMapPoint[] = [
  {
    id: '1',
    lat: 40.7128,
    lng: -74.006,
    waste: {
      waste_id: 1n,
      waste_type: WasteType.Plastic,
      weight: 5000n,
      current_owner: 'GABC1234ABCD5678',
      latitude: 407128000n,
      longitude: -740060000n,
      recycled_timestamp: 1700000000,
      is_active: true,
      is_confirmed: false,
      confirmer: '',
    },
  },
  {
    id: '2',
    lat: 51.5074,
    lng: -0.1278,
    waste: {
      waste_id: 2n,
      waste_type: WasteType.Paper,
      weight: 2000n,
      current_owner: 'GDEF5678DEFG1234',
      latitude: 515074000n,
      longitude: -1278000n,
      recycled_timestamp: 1700100000,
      is_active: true,
      is_confirmed: true,
      confirmer: 'GXYZ9999XYZX1234',
    },
  },
  {
    id: '3',
    lat: 48.8566,
    lng: 2.3522,
    waste: {
      waste_id: 3n,
      waste_type: WasteType.Glass,
      weight: 3000n,
      current_owner: 'GHIJ0123GHIJ5678',
      latitude: 488566000n,
      longitude: 23522000n,
      recycled_timestamp: 1700200000,
      is_active: false,
      is_confirmed: false,
      confirmer: '',
    },
  },
]

const mockParticipantPoints: ParticipantMapPoint[] = [
  {
    id: 'GABC1234ABCD5678',
    lat: 40.7128,
    lng: -74.006,
    participant: {
      address: 'GABC1234ABCD5678',
      role: Role.Recycler,
      name: 'Alice Recycler',
      latitude: 407128000,
      longitude: -740060000,
      registered_at: 1700000000,
    },
  },
  {
    id: 'GDEF5678DEFG1234',
    lat: 51.5074,
    lng: -0.1278,
    participant: {
      address: 'GDEF5678DEFG1234',
      role: Role.Collector,
      name: 'Bob Collector',
      latitude: 515074000,
      longitude: -1278000,
      registered_at: 1700100000,
    },
  },
  {
    id: 'GHIJ0123GHIJ5678',
    lat: 48.8566,
    lng: 2.3522,
    participant: {
      address: 'GHIJ0123GHIJ5678',
      role: Role.Manufacturer,
      name: 'Charlie Manufacturer',
      latitude: 488566000,
      longitude: 23522000,
      registered_at: 1700200000,
    },
  },
]

describe('MapMarker Snapshot Tests', () => {
  it('should render waste markers with correct styling for active pending waste', () => {
    const { container } = render(
      <WasteMap wastes={[mockWastePoints[0]]} participants={[]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render waste markers with correct styling for active confirmed waste', () => {
    const { container } = render(
      <WasteMap wastes={[mockWastePoints[1]]} participants={[]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render waste markers with correct styling for inactive waste', () => {
    const { container } = render(
      <WasteMap wastes={[mockWastePoints[2]]} participants={[]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render participant markers for recycler role', () => {
    const { container } = render(
      <WasteMap wastes={[]} participants={[mockParticipantPoints[0]]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render participant markers for collector role', () => {
    const { container } = render(
      <WasteMap wastes={[]} participants={[mockParticipantPoints[1]]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render participant markers for manufacturer role', () => {
    const { container } = render(
      <WasteMap wastes={[]} participants={[mockParticipantPoints[2]]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render marker cluster with multiple waste items', () => {
    const { container } = render(
      <WasteMap wastes={mockWastePoints} participants={[]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render mixed waste and participant markers', () => {
    const { container } = render(
      <WasteMap wastes={mockWastePoints} participants={mockParticipantPoints} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render waste markers for all waste types', () => {
    const wasteTypePoints: WasteMapPoint[] = [
      {
        id: '1',
        lat: 40.0,
        lng: -74.0,
        waste: {
          waste_id: 1n,
          waste_type: WasteType.Paper,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 400000000n,
          longitude: -740000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
      {
        id: '2',
        lat: 41.0,
        lng: -73.0,
        waste: {
          waste_id: 2n,
          waste_type: WasteType.PetPlastic,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 410000000n,
          longitude: -730000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
      {
        id: '3',
        lat: 42.0,
        lng: -72.0,
        waste: {
          waste_id: 3n,
          waste_type: WasteType.Plastic,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 420000000n,
          longitude: -720000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
      {
        id: '4',
        lat: 43.0,
        lng: -71.0,
        waste: {
          waste_id: 4n,
          waste_type: WasteType.Metal,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 430000000n,
          longitude: -710000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
      {
        id: '5',
        lat: 44.0,
        lng: -70.0,
        waste: {
          waste_id: 5n,
          waste_type: WasteType.Glass,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 440000000n,
          longitude: -700000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
      {
        id: '6',
        lat: 45.0,
        lng: -69.0,
        waste: {
          waste_id: 6n,
          waste_type: WasteType.Organic,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 450000000n,
          longitude: -690000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
      {
        id: '7',
        lat: 46.0,
        lng: -68.0,
        waste: {
          waste_id: 7n,
          waste_type: WasteType.Electronic,
          weight: 1000n,
          current_owner: 'GABC1234ABCD5678',
          latitude: 460000000n,
          longitude: -680000000n,
          recycled_timestamp: 1700000000,
          is_active: true,
          is_confirmed: false,
          confirmer: '',
        },
      },
    ]

    const { container } = render(
      <WasteMap wastes={wasteTypePoints} participants={[]} />
    )
    expect(container).toMatchSnapshot()
  })

  it('should render empty map correctly', () => {
    const { container } = render(
      <WasteMap wastes={[]} participants={[]} />
    )
    expect(container).toMatchSnapshot()
  })
})
