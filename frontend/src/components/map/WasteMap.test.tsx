import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WasteMap } from './WasteMap'
import { WasteType, Role } from '@/api/types'
import type { WasteMapPoint, ParticipantMapPoint } from '@/hooks/useMapData'

// Mock config dependency used by AddressDisplay
vi.mock('@/config', () => ({ config: { network: 'TESTNET' } }))

const mockWaste: WasteMapPoint = {
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
}

const mockParticipant: ParticipantMapPoint = {
  id: 'GABC1234ABCD5678',
  lat: 51.5074,
  lng: -0.1278,
  participant: {
    address: 'GABC1234ABCD5678',
    role: Role.Recycler,
    name: 'Alice',
    latitude: 515074000,
    longitude: -1278000,
    registered_at: 1700000000,
  },
}

describe('WasteMap', () => {
  it('renders the map container', () => {
    render(<WasteMap wastes={[]} participants={[]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders waste markers', () => {
    render(<WasteMap wastes={[mockWaste]} participants={[]} />)
    expect(screen.getAllByTestId('marker').length).toBeGreaterThan(0)
  })

  it('renders participant markers', () => {
    render(<WasteMap wastes={[]} participants={[mockParticipant]} />)
    expect(screen.getAllByTestId('marker').length).toBeGreaterThan(0)
  })

  it('renders both waste and participant markers', () => {
    render(<WasteMap wastes={[mockWaste]} participants={[mockParticipant]} />)
    expect(screen.getAllByTestId('marker').length).toBe(2)
  })

  it('renders waste popup with type label', () => {
    render(<WasteMap wastes={[mockWaste]} participants={[]} />)
    expect(screen.getByText('Plastic')).toBeInTheDocument()
  })

  it('renders waste popup with weight', () => {
    render(<WasteMap wastes={[mockWaste]} participants={[]} />)
    expect(screen.getByText(/5\.00 kg/)).toBeInTheDocument()
  })

  it('renders participant popup with name', () => {
    render(<WasteMap wastes={[]} participants={[mockParticipant]} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders participant popup with role', () => {
    render(<WasteMap wastes={[]} participants={[mockParticipant]} />)
    expect(screen.getByText('Recycler')).toBeInTheDocument()
  })

  it('renders cluster group', () => {
    render(<WasteMap wastes={[mockWaste]} participants={[]} />)
    expect(screen.getByTestId('cluster')).toBeInTheDocument()
  })
})
