import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeaderboardRow } from './LeaderboardRow'

describe('LeaderboardRow', () => {
  const defaultProps = {
    rank: 1,
    address: '0x1234567890123456789012345678901234567890',
    points: 1000,
    tier: 'Gold',
  }

  describe('renders with required props', () => {
    it('renders rank number', () => {
      render(<LeaderboardRow {...defaultProps} />)
      expect(screen.getByText('#1')).toBeInTheDocument()
    })

    it('renders address', () => {
      render(<LeaderboardRow {...defaultProps} />)
      expect(screen.getByText(defaultProps.address)).toBeInTheDocument()
    })

    it('renders points', () => {
      render(<LeaderboardRow {...defaultProps} />)
      expect(screen.getByText('1,000')).toBeInTheDocument()
    })

    it('renders tier badge', () => {
      render(<LeaderboardRow {...defaultProps} />)
      expect(screen.getByText('Gold')).toBeInTheDocument()
    })

    it('renders "points" label', () => {
      render(<LeaderboardRow {...defaultProps} />)
      expect(screen.getByText('points')).toBeInTheDocument()
    })
  })

  describe('rank color styling', () => {
    it('applies gold styling for rank 1', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} rank={1} />)
      const rankBadge = container.querySelector('[class*="yellow"]')
      expect(rankBadge).toBeInTheDocument()
    })

    it('applies silver styling for rank 2', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} rank={2} />)
      const rankBadge = container.querySelector('[class*="gray"]')
      expect(rankBadge).toBeInTheDocument()
    })

    it('applies bronze styling for rank 3', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} rank={3} />)
      const rankBadge = container.querySelector('[class*="orange"]')
      expect(rankBadge).toBeInTheDocument()
    })

    it('applies muted styling for rank 4 and above', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} rank={4} />)
      const rankBadge = container.querySelector('[class*="muted"]')
      expect(rankBadge).toBeInTheDocument()
    })

    it('applies muted styling for high ranks', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} rank={100} />)
      const rankBadge = container.querySelector('[class*="muted"]')
      expect(rankBadge).toBeInTheDocument()
    })
  })

  describe('points formatting', () => {
    it('formats points with locale string', () => {
      render(<LeaderboardRow {...defaultProps} points={1000000} />)
      expect(screen.getByText('1,000,000')).toBeInTheDocument()
    })

    it('renders zero points', () => {
      render(<LeaderboardRow {...defaultProps} points={0} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('renders single digit points', () => {
      render(<LeaderboardRow {...defaultProps} points={5} />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('formats large point values', () => {
      render(<LeaderboardRow {...defaultProps} points={999999999} />)
      expect(screen.getByText('999,999,999')).toBeInTheDocument()
    })
  })

  describe('different tier values', () => {
    it('renders different tier text', () => {
      const { rerender } = render(<LeaderboardRow {...defaultProps} tier="Silver" />)
      expect(screen.getByText('Silver')).toBeInTheDocument()

      rerender(<LeaderboardRow {...defaultProps} tier="Bronze" />)
      expect(screen.getByText('Bronze')).toBeInTheDocument()
    })
  })

  describe('different address formats', () => {
    it('renders ethereum address', () => {
      const ethAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      render(<LeaderboardRow {...defaultProps} address={ethAddress} />)
      expect(screen.getByText(ethAddress)).toBeInTheDocument()
    })

    it('renders short address', () => {
      render(<LeaderboardRow {...defaultProps} address="0x123" />)
      expect(screen.getByText('0x123')).toBeInTheDocument()
    })
  })

  describe('renders children content', () => {
    it('renders children when provided', () => {
      render(
        <LeaderboardRow {...defaultProps}>
          <div>Additional Content</div>
        </LeaderboardRow>
      )
      expect(screen.getByText('Additional Content')).toBeInTheDocument()
    })

    it('renders multiple children elements', () => {
      render(
        <LeaderboardRow {...defaultProps}>
          <span>Item 1</span>
          <span>Item 2</span>
        </LeaderboardRow>
      )
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })

    it('does not render children when not provided', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} />)
      const content = container.textContent
      expect(content).not.toContain('undefined')
    })
  })

  describe('accessibility', () => {
    it('renders with semantic structure', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} />)
      const row = container.firstChild
      expect(row).toHaveClass('flex', 'items-center', 'gap-4')
    })

    it('makes rank badge circular', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} />)
      const rankBadge = container.querySelector('[class*="rounded-full"]')
      expect(rankBadge).toBeInTheDocument()
    })

    it('applies hover state styling', () => {
      const { container } = render(<LeaderboardRow {...defaultProps} />)
      const row = container.firstChild
      expect(row).toHaveClass('hover:bg-accent')
    })
  })
})
