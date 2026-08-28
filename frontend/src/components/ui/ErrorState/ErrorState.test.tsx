import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ErrorState } from './index'

expect.extend(toHaveNoViolations)

describe('ErrorState', () => {
  describe('Rendering', () => {
    it('renders the title', () => {
      render(<ErrorState title="Something went wrong" />)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('renders the message when provided', () => {
      render(<ErrorState title="Error" message="Please try again later." />)
      expect(screen.getByText('Please try again later.')).toBeInTheDocument()
    })

    it('does not render message paragraph when not provided', () => {
      render(<ErrorState title="Error" />)
      expect(screen.queryByText(/please try/i)).not.toBeInTheDocument()
    })

    it('renders action button when action is provided', () => {
      render(<ErrorState title="Error" action={{ label: 'Retry', onClick: vi.fn() }} />)
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('does not render action button when no action provided', () => {
      render(<ErrorState title="Error" />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders the alert circle icon', () => {
      const { container } = render(<ErrorState title="Error" />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<ErrorState title="Error" className="custom-error" />)
      expect(container.firstChild).toHaveClass('custom-error')
    })
  })

  describe('Interactions', () => {
    it('calls action.onClick when button is clicked', async () => {
      const handleClick = vi.fn()
      render(<ErrorState title="Error" action={{ label: 'Retry', onClick: handleClick }} />)
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('title is a heading', () => {
      render(<ErrorState title="Loading failed" />)
      expect(screen.getByRole('heading', { name: /loading failed/i })).toBeInTheDocument()
    })

    it('passes axe audit without action', async () => {
      const { container } = render(<ErrorState title="Error occurred" message="Please try again." />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit with action', async () => {
      const { container } = render(
        <ErrorState
          title="Failed to load"
          action={{ label: 'Try again', onClick: vi.fn() }}
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
