import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { StatCard } from './index'
import { Package } from 'lucide-react'

expect.extend(toHaveNoViolations)

const defaultProps = {
  icon: <Package aria-hidden />,
  label: 'Total Wastes',
  value: '1,234',
}

describe('StatCard', () => {
  describe('Rendering', () => {
    it('renders the label', () => {
      render(<StatCard {...defaultProps} />)
      expect(screen.getByText('Total Wastes')).toBeInTheDocument()
    })

    it('renders the value', () => {
      render(<StatCard {...defaultProps} />)
      expect(screen.getByText('1,234')).toBeInTheDocument()
    })

    it('renders the icon slot', () => {
      const { container } = render(<StatCard {...defaultProps} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders trend label when provided', () => {
      render(<StatCard {...defaultProps} trendLabel="+12% this week" />)
      expect(screen.getByText('+12% this week')).toBeInTheDocument()
    })

    it('does not render trend section when no trend or trendLabel', () => {
      render(<StatCard {...defaultProps} />)
      expect(screen.queryByText(/this week/i)).not.toBeInTheDocument()
    })

    it('renders loading skeleton when isLoading=true', () => {
      const { container } = render(<StatCard {...defaultProps} isLoading />)
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('does not render value text while loading', () => {
      render(<StatCard {...defaultProps} value="1,234" isLoading />)
      // The value should not appear during loading
      expect(screen.queryByText('1,234')).not.toBeInTheDocument()
    })
  })

  describe('Variants', () => {
    const variants = ['default', 'primary', 'success', 'warning', 'destructive'] as const

    it.each(variants)('renders %s variant without crash', (variant) => {
      render(<StatCard {...defaultProps} variant={variant} />)
      expect(screen.getByText('Total Wastes')).toBeInTheDocument()
    })
  })

  describe('Trend display', () => {
    it('shows TrendingUp icon for trend="up"', () => {
      const { container } = render(
        <StatCard {...defaultProps} trend="up" trendLabel="Up trend" />
      )
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(1)
    })

    it('shows TrendingDown icon for trend="down"', () => {
      const { container } = render(
        <StatCard {...defaultProps} trend="down" trendLabel="Down trend" />
      )
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(1)
    })

    it('shows trend label without icon when only trendLabel provided', () => {
      render(<StatCard {...defaultProps} trendLabel="No change" />)
      expect(screen.getByText('No change')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('renders label as visually meaningful text', () => {
      render(<StatCard {...defaultProps} />)
      expect(screen.getByText('Total Wastes')).toBeVisible()
    })

    it('passes axe audit — default', async () => {
      const { container } = render(<StatCard {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — with trend', async () => {
      const { container } = render(
        <StatCard {...defaultProps} trend="up" trendLabel="+5% from last month" />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — loading state', async () => {
      const { container } = render(<StatCard {...defaultProps} isLoading />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
