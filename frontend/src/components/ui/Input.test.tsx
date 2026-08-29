import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Input } from './Input'

expect.extend(toHaveNoViolations)

describe('Input', () => {
  describe('Rendering', () => {
    it('renders a basic input element', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('renders with type="text" by default', () => {
      const { container } = render(<Input />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('renders with different input types', () => {
      const { container } = render(
        <>
          <Input type="email" data-testid="email" />
          <Input type="password" data-testid="password" />
          <Input type="number" data-testid="number" />
          <Input type="date" data-testid="date" />
          <Input type="checkbox" data-testid="checkbox" />
        </>
      )

      expect(container.querySelector('[data-testid="email"]')).toHaveAttribute('type', 'email')
      expect(container.querySelector('[data-testid="password"]')).toHaveAttribute('type', 'password')
      expect(container.querySelector('[data-testid="number"]')).toHaveAttribute('type', 'number')
      expect(container.querySelector('[data-testid="date"]')).toHaveAttribute('type', 'date')
      expect(container.querySelector('[data-testid="checkbox"]')).toHaveAttribute('type', 'checkbox')
    })

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text..." />)
      const input = screen.getByPlaceholderText('Enter text...')
      expect(input).toBeInTheDocument()
    })

    it('renders with default value', () => {
      render(<Input defaultValue="Initial value" />)
      const input = screen.getByDisplayValue('Initial value')
      expect(input).toBeInTheDocument()
    })

    it('renders with disabled state', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:opacity-50')
    })

    it('renders with readonly attribute', () => {
      render(<Input readOnly value="Read only" />)
      const input = screen.getByDisplayValue('Read only')
      expect(input).toHaveAttribute('readOnly')
    })

    it('accepts custom className', () => {
      render(<Input className="custom-input" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input')
    })

    it('renders with name attribute', () => {
      render(<Input name="username" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('name', 'username')
    })

    it('renders with required attribute', () => {
      render(<Input required />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })

    it('applies focus styles', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus-visible:ring-2')
    })
  })

  describe('Interactions', () => {
    it('accepts text input', async () => {
      const user = userEvent.setup()
      render(<Input />)
      const input = screen.getByRole('textbox')

      await user.type(input, 'Hello World')
      expect(input).toHaveValue('Hello World')
    })

    it('handles onChange events', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      render(<Input onChange={handleChange} />)
      const input = screen.getByRole('textbox')

      await user.type(input, 'test')
      expect(handleChange).toHaveBeenCalled()
    })

    it('handles onFocus events', async () => {
      const handleFocus = vi.fn()
      const user = userEvent.setup()
      render(<Input onFocus={handleFocus} />)
      const input = screen.getByRole('textbox')

      await user.click(input)
      expect(handleFocus).toHaveBeenCalled()
    })

    it('handles onBlur events', async () => {
      const handleBlur = vi.fn()
      const user = userEvent.setup()
      render(
        <>
          <Input onBlur={handleBlur} />
          <button>Other</button>
        </>
      )
      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button')

      await user.click(input)
      await user.click(button)
      expect(handleBlur).toHaveBeenCalled()
    })

    it('can be cleared', async () => {
      const user = userEvent.setup()
      render(<Input defaultValue="Initial" />)
      const input = screen.getByDisplayValue('Initial') as HTMLInputElement

      await user.clear(input)
      expect(input.value).toBe('')
    })

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup()
      render(<Input disabled defaultValue="" />)
      const input = screen.getByRole('textbox')

      const initialValue = input.value
      await user.type(input, 'text')
      expect(input).toHaveValue(initialValue)
    })

    it('handles paste events', async () => {
      const user = userEvent.setup()
      render(<Input />)
      const input = screen.getByRole('textbox')

      await user.click(input)
      await user.paste('Pasted content')
      expect(input).toHaveValue('Pasted content')
    })

    it('supports numeric input', async () => {
      const user = userEvent.setup()
      render(<Input type="number" min="0" max="100" />)
      const input = screen.getByRole('spinbutton')

      await user.type(input, '50')
      expect(input).toHaveValue(50)
    })

    it('supports email validation', async () => {
      const user = userEvent.setup()
      render(<Input type="email" />)
      const input = screen.getByRole('textbox')

      await user.type(input, 'test@example.com')
      expect(input).toHaveValue('test@example.com')
    })

    it('receives focus', async () => {
      const user = userEvent.setup()
      render(<Input />)
      const input = screen.getByRole('textbox')

      await user.click(input)
      expect(input).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('has proper role', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('supports label association', () => {
      render(
        <>
          <label htmlFor="email-input">Email</label>
          <Input id="email-input" />
        </>
      )
      const input = screen.getByLabelText('Email')
      expect(input).toBeInTheDocument()
    })

    it('announces disabled state', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('announces required state', () => {
      render(<Input required />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })

    it('supports aria-label', () => {
      render(<Input aria-label="Username" />)
      const input = screen.getByLabelText('Username')
      expect(input).toBeInTheDocument()
    })

    it('supports aria-describedby', () => {
      render(
        <>
          <Input aria-describedby="help-text" />
          <div id="help-text">Enter your username</div>
        </>
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('supports aria-invalid for error states', () => {
      render(<Input aria-invalid="true" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('has visible focus indicator', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus-visible:ring-2')
    })

    it('passes axe accessibility audit', async () => {
      const { container } = render(<Input />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('with label passes accessibility audit', async () => {
      const { container } = render(
        <>
          <label htmlFor="test-input">Input Label</label>
          <Input id="test-input" />
        </>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('all input types pass accessibility audit', async () => {
      const types = ['text', 'email', 'password', 'number', 'date'] as const
      for (const type of types) {
        const { container } = render(<Input type={type} aria-label={type} />)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })
  })

  describe('HTML Attributes', () => {
    it('passes through data attributes', () => {
      const { container } = render(<Input data-testid="custom" data-validate="true" />)
      const input = container.querySelector('[data-testid="custom"]')
      expect(input).toHaveAttribute('data-validate', 'true')
    })

    it('supports min and max attributes', () => {
      const { container } = render(<Input type="number" min="10" max="100" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('min', '10')
      expect(input).toHaveAttribute('max', '100')
    })

    it('supports pattern attribute for validation', () => {
      const { container } = render(<Input pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('pattern', '[0-9]{3}-[0-9]{3}-[0-9]{4}')
    })

    it('supports accept attribute for file inputs', () => {
      const { container } = render(<Input type="file" accept=".pdf,.doc" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('accept', '.pdf,.doc')
    })

    it('supports spellcheck attribute', () => {
      const { container } = render(<Input spellCheck="true" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('spellcheck', 'true')
    })

    it('supports autocomplete attribute', () => {
      const { container } = render(<Input autoComplete="email" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('autocomplete', 'email')
    })
  })
})
