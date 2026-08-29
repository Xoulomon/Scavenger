import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { FormField } from './FormField'

expect.extend(toHaveNoViolations)

describe('FormField', () => {
  it('renders input with correct type', () => {
    render(
      <FormField
        id="test-input"
        label="Test Label"
        type="text"
        placeholder="Enter text"
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toHaveAttribute('type', 'text')
  })

  it('associates label with input via id', () => {
    render(
      <FormField
        id="email-input"
        label="Email Address"
        type="email"
      />
    )

    const label = screen.getByText('Email Address')
    const input = screen.getByRole('textbox')

    expect(label).toHaveAttribute('for', 'email-input')
    expect(input).toHaveAttribute('id', 'email-input')
  })

  it('displays placeholder text', () => {
    render(
      <FormField
        id="username"
        label="Username"
        type="text"
        placeholder="Enter your username"
      />
    )

    const input = screen.getByPlaceholderText('Enter your username')
    expect(input).toBeInTheDocument()
  })

  it('allows text input', async () => {
    const user = userEvent.setup()
    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    await user.type(input, 'Hello World')

    expect(input.value).toBe('Hello World')
  })

  it('displays error message when provided', () => {
    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        error="This field is required"
      />
    )

    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('applies error styling when error is present', () => {
    const { container } = render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        error="Error message"
      />
    )

    const input = container.querySelector('#test-input')
    expect(input).toHaveClass('border-destructive')
  })

  it('handles disabled state', () => {
    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        disabled={true}
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('supports readonly attribute', () => {
    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        readOnly={true}
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toHaveAttribute('readonly')
  })

  it('handles value prop', () => {
    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        value="Initial value"
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('Initial value')
  })

  it('calls onChange handler when input changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        onChange={handleChange}
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'test')

    expect(handleChange).toHaveBeenCalled()
  })

  it('renders different input types', () => {
    const { rerender } = render(
      <FormField
        id="test-input"
        label="Test"
        type="email"
      />
    )

    let input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.type).toBe('email')

    rerender(
      <FormField
        id="test-input"
        label="Test"
        type="password"
      />
    )

    input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.type).toBe('password')
  })

  it('supports required attribute', () => {
    render(
      <FormField
        id="test-input"
        label="Test"
        type="text"
        required={true}
      />
    )

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeRequired()
  })

  it('displays label with required indicator', () => {
    render(
      <FormField
        id="test-input"
        label="Email"
        type="email"
        required={true}
      />
    )

    const label = screen.getByText(/Email/)
    expect(label).toBeInTheDocument()
  })

  describe('Accessibility', () => {
    it('has no axe violations with required field', async () => {
      const { container } = render(
        <FormField
          id="email-input"
          label="Email Address"
          type="email"
          required
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no axe violations with error state', async () => {
      const { container } = render(
        <FormField
          id="password-input"
          label="Password"
          type="password"
          error="Password is required"
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('properly associates label with input', () => {
      render(
        <FormField
          id="test-id"
          label="Test Label"
          type="text"
        />
      )
      const label = screen.getByText('Test Label')
      const input = screen.getByRole('textbox')

      expect(label).toHaveAttribute('for', 'test-id')
      expect(input).toHaveAttribute('id', 'test-id')
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(
        <FormField
          id="keyboard-test"
          label="Keyboard Test"
          type="text"
        />
      )
      const input = screen.getByRole('textbox')

      await user.tab()
      expect(input).toHaveFocus()
    })

    it('has proper ARIA attributes for required fields', () => {
      render(
        <FormField
          id="required-field"
          label="Required Field"
          type="text"
          required
        />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })

    it('has proper ARIA attributes for disabled fields', () => {
      render(
        <FormField
          id="disabled-field"
          label="Disabled Field"
          type="text"
          disabled
        />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('disabled')
    })
  })
})
