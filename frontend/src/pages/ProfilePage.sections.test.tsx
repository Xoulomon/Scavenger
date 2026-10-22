import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { validateProfileImage, getStoredProfileName, setStoredProfileName, PROFILE_NAME_KEY } from '@/lib/profile'
import { WasteTimeline } from '@/pages/ProfilePage'
import { WasteType } from '@/api/types'
import type { Waste } from '@/api/types'

// The details modal needs wallet/contract providers that are irrelevant to the timeline list
vi.mock('@/components/modals/WasteDetailsModal', () => ({ WasteDetailsModal: () => null }))

const ADDRESS = 'GTESTADDRESS'

function makeWaste(id: string, recycled_timestamp: number): Waste {
  return {
    id,
    waste_type: WasteType.Plastic,
    weight: 1,
    recycled_timestamp,
    is_active: true,
    is_confirmed: true,
  } as unknown as Waste
}

describe('ProfilePage section helpers — profile image validation', () => {
  it('accepts a JPEG under the size limit', () => {
    const result = validateProfileImage({ type: 'image/jpeg', size: 1024 })
    expect(result.valid).toBe(true)
  })

  it('rejects a non-image MIME type', () => {
    const result = validateProfileImage({ type: 'application/pdf', size: 1024 })
    expect(result.valid).toBe(false)
  })
})

describe('ProfilePage section helpers — stored profile name', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no name has been stored for an address', () => {
    expect(getStoredProfileName(ADDRESS)).toBeNull()
  })

  it('round-trips a name for an address', () => {
    setStoredProfileName(ADDRESS, 'Alice')
    expect(getStoredProfileName(ADDRESS)).toBe('Alice')
  })

  it('stores the name under the address-scoped key', () => {
    setStoredProfileName(ADDRESS, 'Alice')
    expect(localStorage.getItem(PROFILE_NAME_KEY(ADDRESS))).not.toBeNull()
  })

  it('keeps names separate between addresses', () => {
    setStoredProfileName(ADDRESS, 'Alice')
    setStoredProfileName('GOTHER', 'Bob')
    expect(getStoredProfileName(ADDRESS)).toBe('Alice')
    expect(getStoredProfileName('GOTHER')).toBe('Bob')
  })
})

describe('ProfilePage section — WasteTimeline', () => {
  it('renders an empty timeline without crashing when there are no wastes', () => {
    const { container } = render(<WasteTimeline wastes={[]} isLoading={false} />)
    expect(container).toBeTruthy()
  })

  it('does not show waste entries while loading', () => {
    render(<WasteTimeline wastes={[makeWaste('w-1', 1_700_000_000)]} isLoading={true} />)
    expect(screen.queryByText('w-1')).toBeNull()
  })
})
