import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierBadge } from './TierBadge'

describe('TierBadge', () => {
  describe('renders tier text', () => {
    it('renders tier badge with provided tier text', () => {
      render(<TierBadge tier="Gold" />)
      expect(screen.getByText('Gold')).toBeInTheDocument()
    })

    it('renders different tier values', () => {
      const { rerender } = render(<TierBadge tier="Silver" />)
      expect(screen.getByText('Silver')).toBeInTheDocument()

      rerender(<TierBadge tier="Bronze" />)
      expect(screen.getByText('Bronze')).toBeInTheDocument()

      rerender(<TierBadge tier="Platinum" />)
      expect(screen.getByText('Platinum')).toBeInTheDocument()
    })

    it('renders numeric tier values', () => {
      render(<TierBadge tier="1" />)
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('renders empty string tier', () => {
      render(<TierBadge tier="" />)
      expect(screen.getByRole('button', { hidden: true })).toBeInTheDocument()
    })
  })

  describe('applies secondary variant', () => {
    it('renders badge with secondary variant class', () => {
      const { container } = render(<TierBadge tier="Gold" />)
      const badge = container.querySelector('[class*="secondary"]')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('respects custom className', () => {
    it('applies custom className prop', () => {
      const { container } = render(<TierBadge tier="Gold" className="text-xl font-bold" />)
      const badge = container.firstChild
      expect(badge).toHaveClass('text-xl', 'font-bold')
    })

    it('combines variant class with custom className', () => {
      const { container } = render(<TierBadge tier="Gold" className="custom-class" />)
      const badge = container.querySelector('[class*="custom-class"]')
      expect(badge).toBeInTheDocument()
    })

    it('renders without custom className when not provided', () => {
      const { container } = render(<TierBadge tier="Gold" />)
      const badge = container.firstChild as HTMLElement
      expect(badge.className).not.toContain('undefined')
    })
  })

  describe('renders different tier formats', () => {
    it('renders tier with special characters', () => {
      render(<TierBadge tier="Tier-A" />)
      expect(screen.getByText('Tier-A')).toBeInTheDocument()
    })

    it('renders tier with spaces', () => {
      render(<TierBadge tier="Premium Plus" />)
      expect(screen.getByText('Premium Plus')).toBeInTheDocument()
    })

    it('renders tier with uppercase', () => {
      render(<TierBadge tier="ELITE" />)
      expect(screen.getByText('ELITE')).toBeInTheDocument()
    })
  })
})
