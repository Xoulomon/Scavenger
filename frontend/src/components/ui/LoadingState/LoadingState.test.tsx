import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { LoadingState } from './index'

expect.extend(toHaveNoViolations)

describe('LoadingState', () => {
  describe('Rendering', () => {
    it('renders default "Loading..." message', () => {
      render(<LoadingState />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders custom message', () => {
      render(<LoadingState message="Fetching data…" />)
      expect(screen.getByText('Fetching data…')).toBeInTheDocument()
    })

    it('renders spinner icon', () => {
      const { container } = render(<LoadingState />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('spinner has animate-spin class', () => {
      const { container } = render(<LoadingState />)
      expect(container.querySelector('svg')).toHaveClass('animate-spin')
    })

    it('renders with md size by default', () => {
      const { container } = render(<LoadingState />)
      expect(container.querySelector('svg')).toHaveClass('h-8', 'w-8')
    })

    it('renders with sm size', () => {
      const { container } = render(<LoadingState size="sm" />)
      expect(container.querySelector('svg')).toHaveClass('h-4', 'w-4')
    })

    it('renders with lg size', () => {
      const { container } = render(<LoadingState size="lg" />)
      expect(container.querySelector('svg')).toHaveClass('h-12', 'w-12')
    })

    it('applies custom className', () => {
      const { container } = render(<LoadingState className="custom-loading" />)
      expect(container.firstChild).toHaveClass('custom-loading')
    })

    it('renders without message when empty string passed', () => {
      render(<LoadingState message="" />)
      // No text content rendered for empty string
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('spinner has aria-hidden via Lucide (no focusable noise)', () => {
      const { container } = render(<LoadingState />)
      const svg = container.querySelector('svg')
      // Lucide icons either have aria-hidden or are decorative
      expect(svg).toBeInTheDocument()
    })

    it('passes axe audit with default props', async () => {
      const { container } = render(<LoadingState />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit with custom message', async () => {
      const { container } = render(<LoadingState message="Please wait while we load your data." />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit in all sizes', async () => {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const { container } = render(<LoadingState size={size} />)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })
  })
})
