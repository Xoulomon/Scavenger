import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Switch } from './index'

expect.extend(toHaveNoViolations)

describe('Switch', () => {
  describe('Rendering', () => {
    it('renders a switch element', () => {
      render(<Switch aria-label="Enable notifications" />)
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('is off by default', () => {
      render(<Switch aria-label="Toggle" />)
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    })

    it('is on when checked prop is true', () => {
      render(<Switch checked aria-label="Toggle on" />)
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })

    it('is disabled when disabled prop is set', () => {
      render(<Switch disabled aria-label="Disabled switch" />)
      expect(screen.getByRole('switch')).toBeDisabled()
    })

    it('applies custom className', () => {
      render(<Switch className="custom-switch" aria-label="Custom" />)
      expect(screen.getByRole('switch')).toHaveClass('custom-switch')
    })

    it('has focus ring styles', () => {
      render(<Switch aria-label="Focus switch" />)
      expect(screen.getByRole('switch')).toHaveClass('focus-visible:ring-2')
    })

    it('thumb renders inside the switch', () => {
      const { container } = render(<Switch aria-label="With thumb" />)
      // Radix Switch renders a thumb span inside the root
      const thumb = container.querySelector('[data-state]')
      expect(thumb).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onCheckedChange when clicked', async () => {
      const handleChange = vi.fn()
      render(<Switch onCheckedChange={handleChange} aria-label="Toggle" />)
      await userEvent.click(screen.getByRole('switch'))
      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('passes true to onCheckedChange when toggled on', async () => {
      const handleChange = vi.fn()
      render(<Switch checked={false} onCheckedChange={handleChange} aria-label="Toggle on" />)
      await userEvent.click(screen.getByRole('switch'))
      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('does not call onCheckedChange when disabled', async () => {
      const handleChange = vi.fn()
      render(<Switch disabled onCheckedChange={handleChange} aria-label="Disabled" />)
      await userEvent.click(screen.getByRole('switch'))
      expect(handleChange).not.toHaveBeenCalled()
    })

    it('can be toggled via Space key', async () => {
      const handleChange = vi.fn()
      render(<Switch onCheckedChange={handleChange} aria-label="Space toggle" />)
      const sw = screen.getByRole('switch')
      sw.focus()
      await userEvent.keyboard(' ')
      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has role="switch"', () => {
      render(<Switch aria-label="Role check" />)
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('has aria-checked attribute', () => {
      render(<Switch checked={true} aria-label="Checked switch" />)
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })

    it('has accessible name via aria-label', () => {
      render(<Switch aria-label="Enable dark mode" />)
      expect(screen.getByLabelText('Enable dark mode')).toBeInTheDocument()
    })

    it('passes axe audit (off)', async () => {
      const { container } = render(
        <div>
          <label htmlFor="sw1">Enable feature</label>
          <Switch id="sw1" />
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit (on)', async () => {
      const { container } = render(
        <div>
          <label htmlFor="sw2">Enable feature</label>
          <Switch id="sw2" checked />
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
