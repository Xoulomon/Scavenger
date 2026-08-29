import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from './Button'

expect.extend(toHaveNoViolations)

describe('Button', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
    })

    it('renders with primary variant', () => {
      render(<Button variant="primary">Submit</Button>)
      const button = screen.getByRole('button', { name: /submit/i })
      expect(button).toHaveClass('bg-primary')
    })

    it('renders with secondary variant', () => {
      render(<Button variant="secondary">Cancel</Button>)
      const button = screen.getByRole('button', { name: /cancel/i })
      expect(button).toHaveClass('bg-secondary')
    })

    it('renders with outline variant', () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole('button', { name: /outline/i })
      expect(button).toHaveClass('border-input')
    })

    it('renders with ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button', { name: /ghost/i })
      expect(button).toHaveClass('hover:bg-accent')
    })

    it('renders with destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>)
      const button = screen.getByRole('button', { name: /delete/i })
      expect(button).toHaveClass('bg-destructive')
    })

    it('renders with link variant', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button', { name: /link/i })
      expect(button).toHaveClass('text-primary')
    })

    it('renders with default size', () => {
      render(<Button size="default">Default Size</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-11')
    })

    it('renders with sm size', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-11')
    })

    it('renders with lg size', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-12')
    })

    it('renders with icon size', () => {
      render(<Button size="icon">×</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('w-10')
    })

    it('renders disabled state', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:opacity-50')
    })

    it('accepts custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    it('renders with children nodes', () => {
      render(
        <Button>
          <span data-testid="icon">🔄</span>
          Refresh
        </Button>
      )
      expect(screen.getByTestId('icon')).toBeInTheDocument()
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(<Button onClick={handleClick}>Click</Button>)

      const button = screen.getByRole('button')
      await user.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(
        <Button onClick={handleClick} disabled>
          Click
        </Button>
      )

      const button = screen.getByRole('button')
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('can be activated with Enter key', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(<Button onClick={handleClick}>Click</Button>)

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalled()
    })

    it('can be activated with Space key', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(<Button onClick={handleClick}>Click</Button>)

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard(' ')
      expect(handleClick).toHaveBeenCalled()
    })

    it('receives focus', async () => {
      const user = userEvent.setup()
      render(<Button>Focusable</Button>)
      const button = screen.getByRole('button')
      await user.click(button)
      expect(button).toHaveFocus()
    })

    it('type attribute is respected', () => {
      const { container } = render(
        <>
          <Button type="submit">Submit</Button>
          <Button type="reset">Reset</Button>
          <Button type="button">Button</Button>
        </>
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons[0]).toHaveAttribute('type', 'submit')
      expect(buttons[1]).toHaveAttribute('type', 'reset')
      expect(buttons[2]).toHaveAttribute('type', 'button')
    })
  })

  describe('Accessibility', () => {
    it('has accessible button role', () => {
      render(<Button>Accessible</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAccessibleName(/accessible/i)
    })

    it('announces disabled state to assistive technology', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })

    it('supports aria-label', () => {
      render(<Button aria-label="Custom label">Icon</Button>)
      const button = screen.getByLabelText('Custom label')
      expect(button).toBeInTheDocument()
    })

    it('supports aria-describedby', () => {
      render(
        <>
          <Button aria-describedby="help">Help</Button>
          <div id="help">This is helpful</div>
        </>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'help')
    })

    it('has visible focus indicator', () => {
      render(<Button>Focusable</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus-visible:ring-2')
    })

    it('passes axe accessibility audit', async () => {
      const { container } = render(<Button>Accessible</Button>)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('all variants pass accessibility audit', async () => {
      const variants = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
      for (const variant of variants) {
        const { container } = render(<Button variant={variant}>{variant}</Button>)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })

    it('all sizes pass accessibility audit', async () => {
      const sizes = ['default', 'sm', 'lg', 'icon'] as const
      for (const size of sizes) {
        const { container } = render(<Button size={size}>Size</Button>)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })
  })

  describe('HTML Attributes', () => {
    it('passes through data attributes', () => {
      render(<Button data-testid="custom-button" data-tracking="click-me">
        Data
      </Button>)
      const button = screen.getByTestId('custom-button')
      expect(button).toHaveAttribute('data-tracking', 'click-me')
    })

    it('inherits standard button attributes', () => {
      render(
        <Button
          title="Button title"
          aria-pressed="false"
        >
          Attributes
        </Button>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Button title')
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('renders form button correctly', () => {
      render(
        <form>
          <Button type="submit" form="test-form">
            Submit
          </Button>
        </form>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
    })
  })
})
