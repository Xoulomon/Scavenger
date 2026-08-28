import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { IncentiveCard } from '../IncentiveCard'
import type { Incentive } from '@/api/types'
import { WasteType } from '@/api/types'

expect.extend(toHaveNoViolations)

const baseIncentive: Incentive = {
  id: 1,
  rewarder: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  waste_type: WasteType.Plastic,
  reward_points: 100,
  total_budget: 10000,
  remaining_budget: 7500,
  active: true,
  created_at: 1700000000,
}

describe('IncentiveCard', () => {
  describe('Rendering', () => {
    it('renders waste type label', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      expect(screen.getByText(/plastic/i)).toBeInTheDocument()
    })

    it('renders "Active" badge when incentive is active', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders "Inactive" badge when incentive is inactive', () => {
      render(<IncentiveCard incentive={{ ...baseIncentive, active: false }} />)
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('renders reward points', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      // reward_points formatted as token amount with " pts"
      expect(screen.getByText(/pts/i)).toBeInTheDocument()
    })

    it('renders budget progress bar', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('renders rewarder address (truncated)', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      // AddressDisplay shows truncated address
      expect(screen.getByText(/GABC/i)).toBeInTheDocument()
    })

    it('does not render edit/deactivate buttons when isManufacturer=false', () => {
      render(<IncentiveCard incentive={baseIncentive} isManufacturer={false} />)
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
    })

    it('renders edit and deactivate buttons when isManufacturer=true', () => {
      render(<IncentiveCard incentive={baseIncentive} isManufacturer />)
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
    })

    it('disables edit and deactivate buttons when incentive is inactive', () => {
      render(
        <IncentiveCard incentive={{ ...baseIncentive, active: false }} isManufacturer />
      )
      expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /deactivate/i })).toBeDisabled()
    })
  })

  describe('Interactions', () => {
    it('calls onEdit when Edit button clicked', async () => {
      const handleEdit = vi.fn()
      render(<IncentiveCard incentive={baseIncentive} isManufacturer onEdit={handleEdit} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))
      expect(handleEdit).toHaveBeenCalledWith(baseIncentive)
    })

    it('calls onDeactivate when Deactivate button clicked', async () => {
      const handleDeactivate = vi.fn()
      render(
        <IncentiveCard incentive={baseIncentive} isManufacturer onDeactivate={handleDeactivate} />
      )
      await userEvent.click(screen.getByRole('button', { name: /deactivate/i }))
      expect(handleDeactivate).toHaveBeenCalledWith(baseIncentive)
    })
  })

  describe('Progress bar', () => {
    it('sets aria-valuenow to budget percentage', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      const bar = screen.getByRole('progressbar')
      // 7500/10000 = 75
      expect(bar).toHaveAttribute('aria-valuenow', '75')
    })

    it('progress bar aria-valuemin is 0', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0')
    })

    it('progress bar aria-valuemax is 100', () => {
      render(<IncentiveCard incentive={baseIncentive} />)
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100')
    })
  })

  describe('Accessibility', () => {
    it('passes axe audit — read-only view', async () => {
      const { container } = render(<IncentiveCard incentive={baseIncentive} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — manufacturer view', async () => {
      const { container } = render(
        <IncentiveCard incentive={baseIncentive} isManufacturer />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
