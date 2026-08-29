import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WasteMapPage } from '../WasteMapPage'
import { WasteType, Role } from '@/api/types'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

const mocks = vi.hoisted(() => ({
  useMapData: vi.fn(),
}))

vi.mock('@/hooks/useMapData', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useMapData')>('@/hooks/useMapData')
  return {
    ...actual,
    useMapData: (...args: unknown[]) => mocks.useMapData(...args),
  }
})

const wastePoint = {
  id: '1',
  lat: 40.7128,
  lng: -74.006,
  waste: {
    waste_id: 1n,
    waste_type: WasteType.Plastic,
    weight: 5000n,
    current_owner: 'GOWNER',
    latitude: 407128000n,
    longitude: -740060000n,
    recycled_timestamp: 1700000000,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
  },
}

const participantPoint = {
  id: 'GPARTICIPANT',
  lat: 40.7306,
  lng: -73.9352,
  participant: {
    address: 'GPARTICIPANT',
    role: Role.Recycler,
    name: 'Downtown Recycler',
    latitude: 407306000,
    longitude: -739352000,
    registered_at: 1700000000,
  },
}

describe('WasteMapPage', () => {
  it('renders the map view with filters and location counts', async () => {
    mocks.useMapData.mockReturnValue({
      wastes: [wastePoint],
      participants: [participantPoint],
      isLoading: false,
    })

    render(<WasteMapPage />)

    expect(screen.getByRole('heading', { name: /waste map/i })).toBeInTheDocument()
    expect(screen.getByText('1 waste item - 1 participant')).toBeInTheDocument()
    expect(screen.getByLabelText('Location')).toBeInTheDocument()
    expect(await screen.findByTestId('map-container')).toBeInTheDocument()
  })

  it('shows an empty state when filters remove every location', async () => {
    mocks.useMapData.mockReturnValue({
      wastes: [],
      participants: [],
      isLoading: false,
    })

    render(<WasteMapPage />)

    expect(await screen.findByText('No waste locations match the current filters.')).toBeInTheDocument()
  })
})
