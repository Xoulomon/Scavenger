// Feature: WasteJourneyTimeline component
// Validates: horizontal/vertical layout, zoom, export, event building

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WasteJourneyTimeline } from './WasteJourneyTimeline'
import { WasteType } from '@/api/types'
import type { Waste, WasteTransfer } from '@/api/types'

const mockWaste: Waste = {
  waste_id: 42n,
  waste_type: WasteType.Paper,
  weight: 500n,
  current_owner: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456789',
  latitude: 0n,
  longitude: 0n,
  recycled_timestamp: 1700000000,
  is_active: true,
  is_confirmed: false,
  confirmer: '',
}

const mockTransfers: WasteTransfer[] = [
  {
    waste_id: 42,
    from: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456789',
    to: 'GZYXWVUTSRQPONMLKJIHGFEDCBA987654321098765432109876543210',
    transferred_at: 1700001000,
  },
]

describe('WasteJourneyTimeline', () => {
  it('renders the waste ID in the toolbar', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={[]} />)
    expect(screen.getByText(/Waste #42/)).toBeInTheDocument()
  })

  it('renders a listitem for each event', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={mockTransfers} />)
    const items = screen.getAllByRole('listitem')
    // submitted + 1 transfer = 2 events
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('shows event details on node click', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={[]} />)
    const btn = screen.getByLabelText('Submitted event details')
    fireEvent.click(btn)
    expect(screen.getByText(/Paper/)).toBeInTheDocument()
  })

  it('toggles layout between horizontal and vertical', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={[]} layout="horizontal" />)
    const toggleBtn = screen.getByLabelText('Toggle layout')
    fireEvent.click(toggleBtn)
    // After toggle, zoom-in/out still present
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
  })

  it('zoom in button is disabled at max zoom (1.6)', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={[]} />)
    const zoomIn = screen.getByLabelText('Zoom in')
    // Click 6 times to reach max (1.0 + 0.1*6 = 1.6)
    for (let i = 0; i < 6; i++) fireEvent.click(zoomIn)
    expect(zoomIn).toBeDisabled()
  })

  it('zoom out button is disabled at min zoom (0.6)', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={[]} />)
    const zoomOut = screen.getByLabelText('Zoom out')
    // Click 4 times to reach min (1.0 - 0.1*4 = 0.6)
    for (let i = 0; i < 4; i++) fireEvent.click(zoomOut)
    expect(zoomOut).toBeDisabled()
  })

  it('renders confirmed event when waste is confirmed', () => {
    const confirmedWaste: Waste = {
      ...mockWaste,
      is_confirmed: true,
      confirmer: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890123456789',
    }
    render(<WasteJourneyTimeline waste={confirmedWaste} transfers={[]} />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('renders deactivated event when waste is inactive', () => {
    const inactiveWaste: Waste = { ...mockWaste, is_active: false }
    render(<WasteJourneyTimeline waste={inactiveWaste} transfers={[]} />)
    expect(screen.getByText('Deactivated')).toBeInTheDocument()
  })

  it('export button is present and accessible', () => {
    render(<WasteJourneyTimeline waste={mockWaste} transfers={[]} />)
    expect(screen.getByLabelText('Export timeline')).toBeInTheDocument()
  })
})
