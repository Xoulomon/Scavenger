import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { EmptyState } from './index'
import { Package } from 'lucide-react'

expect.extend(toHaveNoViolations)

describe('EmptyState', () => {
  describe('Rendering', () => {
    it('renders the title', () => {
      render(<EmptyState title="No items found" />)
      expect(screen.getByText('No items found')).toBeInTheDocument()
    })

    it('renders description when provided', () => {
      render(<EmptyState title="Empty" description="Try adding some items first." />)
      expect(screen.getByText('Try adding some items first.')).toBeInTheDocument()
    })

    it('does not render description when not provided', () => {
      render(<EmptyState title="Empty" />)
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
    })

    it('renders action button when action is provided', () => {
      render(
        <EmptyState
          title="Empty"
          action={{ label: 'Add Item', onClick: vi.fn() }}
        />
      )
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
    })

    it('does not render action button when no action provided', () => {
      render(<EmptyState title="Empty" />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders icon when icon prop provided', () => {
      const { container } = render(<EmptyState title="Empty" icon={Package} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('does not render icon when icon prop omitted', () => {
      const { container } = render(<EmptyState title="Empty" />)
      expect(container.querySelector('svg')).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<EmptyState title="Empty" className="custom-empty" />)
      expect(container.firstChild).toHaveClass('custom-empty')
    })
  })

  describe('Interactions', () => {
    it('calls action.onClick when action button is clicked', async () => {
      const handleClick = vi.fn()
      render(<EmptyState title="Empty" action={{ label: 'Retry', onClick: handleClick }} />)
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('title is a heading', () => {
      render(<EmptyState title="No results" />)
      expect(screen.getByRole('heading', { name: /no results/i })).toBeInTheDocument()
    })

    it('passes axe audit without action', async () => {
      const { container } = render(<EmptyState title="Nothing here" description="Add items to get started." />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit with action button', async () => {
      const { container } = render(
        <EmptyState
          title="Nothing here"
          action={{ label: 'Get started', onClick: vi.fn() }}
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
