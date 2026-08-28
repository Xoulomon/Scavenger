import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { WasteCard } from '../WasteCard'
import type { Waste } from '@/api/types'
import { WasteType } from '@/api/types'

expect.extend(toHaveNoViolations)

const baseWaste: Waste = {
  waste_id: BigInt(42),
  waste_type: WasteType.Plastic,
  weight: BigInt(500),
  current_owner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  latitude: BigInt(40000000),
  longitude: BigInt(-74000000),
  recycled_timestamp: 1700000000,
  is_active: true,
  is_confirmed: false,
  confirmer: '',
}

describe('WasteCard', () => {
  describe('Rendering', () => {
    it('renders waste type label', () => {
      render(<WasteCard waste={baseWaste} />)
      expect(screen.getByText(/plastic/i)).toBeInTheDocument()
    })

    it('renders waste ID in correct format', () => {
      render(<WasteCard waste={baseWaste} />)
      expect(screen.getByText('#42')).toBeInTheDocument()
    })

    it('renders weight in grams when under 1000', () => {
      render(<WasteCard waste={baseWaste} />)
      expect(screen.getByText('500 g')).toBeInTheDocument()
    })

    it('renders weight in kg when 1000 or more', () => {
      render(<WasteCard waste={{ ...baseWaste, weight: BigInt(2500) }} />)
      expect(screen.getByText('2.50 kg')).toBeInTheDocument()
    })

    it('renders "Pending" badge for unconfirmed active waste', () => {
      render(<WasteCard waste={baseWaste} />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders "Confirmed" badge for confirmed waste', () => {
      render(<WasteCard waste={{ ...baseWaste, is_confirmed: true }} />)
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
    })

    it('renders "Inactive" badge for inactive waste', () => {
      render(<WasteCard waste={{ ...baseWaste, is_active: false }} />)
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('renders current owner address', () => {
      render(<WasteCard waste={baseWaste} />)
      // AddressDisplay truncates but shows part of it
      expect(screen.getByText(/GABC/i)).toBeInTheDocument()
    })

    it('renders action slot when provided', () => {
      render(
        <WasteCard
          waste={baseWaste}
          actions={<button>Transfer</button>}
        />
      )
      expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument()
    })

    it('does not render footer when no actions provided', () => {
      render(<WasteCard waste={baseWaste} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<WasteCard waste={baseWaste} className="custom-class" />)
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('All waste types', () => {
    const types = [
      WasteType.Paper,
      WasteType.PetPlastic,
      WasteType.Plastic,
      WasteType.Metal,
      WasteType.Glass,
      WasteType.Organic,
      WasteType.Electronic,
    ] as const

    it.each(types)('renders without crash for waste_type %s', (wt) => {
      expect(() =>
        render(<WasteCard waste={{ ...baseWaste, waste_type: wt }} />)
      ).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('passes axe audit — pending waste', async () => {
      const { container } = render(<WasteCard waste={baseWaste} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — confirmed waste', async () => {
      const { container } = render(
        <WasteCard waste={{ ...baseWaste, is_confirmed: true }} />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — inactive waste', async () => {
      const { container } = render(
        <WasteCard waste={{ ...baseWaste, is_active: false }} />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
