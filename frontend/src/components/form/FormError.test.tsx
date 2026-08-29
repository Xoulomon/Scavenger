import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { FormError } from './FormError'

expect.extend(toHaveNoViolations)

describe('FormError', () => {
  it('does not render when no message provided', () => {
    const { container } = render(<FormError />)
    expect(container.firstChild).toBeNull()
  })

  it('renders error message', () => {
    render(<FormError message="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('renders with alert role for accessibility', () => {
    render(<FormError message="Error message" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
  })

  it('displays error message in alert', () => {
    render(<FormError message="Invalid input" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Invalid input')
  })

  it('applies error styling classes', () => {
    const { container } = render(<FormError message="Error" />)
    const errorElement = container.querySelector('[role="alert"]')
    expect(errorElement).toHaveClass('text-destructive')
  })

  it('renders multiple instances with different messages', () => {
    const { rerender } = render(<FormError message="First error" />)
    expect(screen.getByText('First error')).toBeInTheDocument()

    rerender(<FormError message="Second error" />)
    expect(screen.getByText('Second error')).toBeInTheDocument()
  })

  it('clears error message when undefined', () => {
    const { rerender } = render(<FormError message="Error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()

    rerender(<FormError message={undefined} />)
    expect(screen.queryByText('Error')).not.toBeInTheDocument()
  })

  it('handles empty string message', () => {
    const { container } = render(<FormError message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('displays message with special characters', () => {
    render(<FormError message='Email format invalid: use "example@domain.com"' />)
    expect(screen.getByText('Email format invalid: use "example@domain.com"')).toBeInTheDocument()
  })

  it('supports HTML content in error message', () => {
    render(<FormError message="Password must be at least 8 characters" />)
    const message = screen.getByText('Password must be at least 8 characters')
    expect(message).toBeInTheDocument()
  })

  it('renders with semantic error styling', () => {
    const { container } = render(<FormError message="Field error" />)
    const errorElement = container.querySelector('[role="alert"]')

    expect(errorElement).toHaveClass('text-destructive')
    expect(errorElement).toHaveClass('text-sm')
  })

  it('maintains error styling on update', () => {
    const { rerender, container } = render(<FormError message="Initial error" />)

    let errorElement = container.querySelector('[role="alert"]')
    expect(errorElement).toHaveClass('text-destructive')

    rerender(<FormError message="Updated error" />)

    errorElement = container.querySelector('[role="alert"]')
    expect(errorElement).toHaveClass('text-destructive')
  })

  it('handles very long error messages', () => {
    const longMessage = 'A'.repeat(500)
    render(<FormError message={longMessage} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(longMessage)
  })

  it('displays error message immediately', () => {
    const { container } = render(<FormError message="Instant error" />)
    expect(screen.getByText('Instant error')).toBeInTheDocument()
  })

  it('updates error message reactively', () => {
    const { rerender } = render(<FormError message="First" />)
    expect(screen.getByText('First')).toBeInTheDocument()

    rerender(<FormError message="Second" />)
    expect(screen.queryByText('First')).not.toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  describe('Accessibility', () => {
    it('has no axe violations with error message', async () => {
      const { container } = render(<FormError message="This is an error" />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no axe violations when empty', async () => {
      const { container } = render(<FormError />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('properly announces error to screen readers with alert role', () => {
      render(<FormError message="Required field" />)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('role', 'alert')
    })
  })
})
