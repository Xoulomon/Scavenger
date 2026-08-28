import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Checkbox } from './index'

expect.extend(toHaveNoViolations)

describe('Checkbox', () => {
  describe('Rendering', () => {
    it('renders a checkbox element', () => {
      render(<Checkbox aria-label="Accept terms" />)
      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('is unchecked by default', () => {
      render(<Checkbox aria-label="Accept terms" />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('renders as checked when checked prop is true', () => {
      render(<Checkbox checked aria-label="Checked" />)
      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it('renders as disabled when disabled prop is set', () => {
      render(<Checkbox disabled aria-label="Disabled" />)
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('applies custom className', () => {
      render(<Checkbox className="custom-checkbox" aria-label="Custom" />)
      expect(screen.getByRole('checkbox')).toHaveClass('custom-checkbox')
    })

    it('has focus ring class', () => {
      render(<Checkbox aria-label="Focusable" />)
      expect(screen.getByRole('checkbox')).toHaveClass('focus-visible:ring-2')
    })
  })

  describe('Interactions', () => {
    it('calls onCheckedChange when clicked', async () => {
      const handleChange = vi.fn()
      render(<Checkbox onCheckedChange={handleChange} aria-label="Toggle" />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('does not call onCheckedChange when disabled', async () => {
      const handleChange = vi.fn()
      render(<Checkbox disabled onCheckedChange={handleChange} aria-label="Disabled toggle" />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(handleChange).not.toHaveBeenCalled()
    })

    it('can be toggled via Space key', async () => {
      const handleChange = vi.fn()
      render(<Checkbox onCheckedChange={handleChange} aria-label="Space toggle" />)
      const checkbox = screen.getByRole('checkbox')
      checkbox.focus()
      await userEvent.keyboard(' ')
      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has accessible name via aria-label', () => {
      render(<Checkbox aria-label="I agree to terms" />)
      expect(screen.getByLabelText('I agree to terms')).toBeInTheDocument()
    })

    it('is labelled by associated label element', () => {
      render(
        <label>
          <Checkbox />
          Accept Terms
        </label>
      )
      expect(screen.getByLabelText('Accept Terms')).toBeInTheDocument()
    })

    it('passes axe audit (unchecked)', async () => {
      const { container } = render(
        <div>
          <label htmlFor="cb">Accept Terms</label>
          <Checkbox id="cb" />
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit (checked)', async () => {
      const { container } = render(
        <div>
          <label htmlFor="cb2">I agree</label>
          <Checkbox id="cb2" checked />
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
