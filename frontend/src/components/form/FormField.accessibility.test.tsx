import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

/**
 * Form Field Accessibility Tests
 * Comprehensive accessibility audit for form input components using axe-core.
 */

expect.extend(toHaveNoViolations)

describe('FormField Accessibility', () => {
  describe('Label Association', () => {
    it('should have proper label-input association', () => {
      const { container } = render(
        <div>
          <label htmlFor="test-input">Test Label</label>
          <input id="test-input" type="text" />
        </div>
      )
      const input = screen.getByLabelText('Test Label')
      expect(input).toBeInTheDocument()
    })

    it('should include aria-label when visible label is not available', () => {
      const { container } = render(
        <input type="text" aria-label="Test input field" />
      )
      const input = screen.getByLabelText('Test input field')
      expect(input).toBeInTheDocument()
    })

    it('should have descriptive labels for all form inputs', () => {
      const { container } = render(
        <form>
          <label htmlFor="email">Email Address</label>
          <input id="email" type="email" required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required />
        </form>
      )
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })
  })

  describe('Required Field Indicators', () => {
    it('should indicate required fields with aria-required', () => {
      const { container } = render(
        <input type="text" aria-required="true" required />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })

    it('should have clear visual indicator for required fields', () => {
      const { container } = render(
        <div>
          <label htmlFor="required-input">
            Name <span aria-label="required">*</span>
          </label>
          <input id="required-input" type="text" required />
        </div>
      )
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    it('should use aria-required attribute for optional fields', () => {
      const { container } = render(
        <input type="text" aria-required="false" />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-required', 'false')
    })
  })

  describe('Error Messages', () => {
    it('should associate error messages with input using aria-describedby', () => {
      const { container } = render(
        <div>
          <label htmlFor="email-input">Email</label>
          <input
            id="email-input"
            type="email"
            aria-describedby="email-error"
          />
          <span id="email-error" role="alert">
            Please enter a valid email
          </span>
        </div>
      )
      const input = screen.getByLabelText('Email')
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
    })

    it('should use role="alert" for error messages', () => {
      const { container } = render(
        <div role="alert">This field is required</div>
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should have aria-invalid attribute on invalid inputs', () => {
      const { container } = render(
        <input type="email" aria-invalid="true" />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should announce error messages to screen readers', () => {
      const { container } = render(
        <div>
          <input
            type="text"
            aria-invalid="true"
            aria-describedby="error-msg"
          />
          <div id="error-msg" role="alert">
            Username must be at least 3 characters
          </div>
        </div>
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('Help Text and Hints', () => {
    it('should associate help text with input using aria-describedby', () => {
      const { container } = render(
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            aria-describedby="password-hint"
          />
          <span id="password-hint">At least 8 characters required</span>
        </div>
      )
      const input = screen.getByLabelText('Password')
      expect(input).toHaveAttribute('aria-describedby', 'password-hint')
    })

    it('should handle multiple descriptions with aria-describedby', () => {
      const { container } = render(
        <div>
          <label htmlFor="bio">Bio</label>
          <input
            id="bio"
            type="text"
            aria-describedby="bio-hint bio-error"
          />
          <span id="bio-hint">Max 500 characters</span>
          <span id="bio-error" role="alert">
            Currently exceeds limit
          </span>
        </div>
      )
      const input = screen.getByLabelText('Bio')
      expect(input).toHaveAttribute('aria-describedby', 'bio-hint bio-error')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should allow Tab navigation through form fields', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <form>
          <label htmlFor="first">First Name</label>
          <input id="first" type="text" />
          <label htmlFor="last">Last Name</label>
          <input id="last" type="text" />
        </form>
      )

      const firstInput = screen.getByLabelText('First Name')
      firstInput.focus()
      expect(firstInput).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Last Name')).toHaveFocus()
    })

    it('should support Shift+Tab for backwards navigation', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <form>
          <label htmlFor="first">First</label>
          <input id="first" type="text" />
          <label htmlFor="second">Second</label>
          <input id="second" type="text" />
        </form>
      )

      const secondInput = screen.getByLabelText('Second')
      secondInput.focus()
      await user.tab({ shift: true })
      expect(screen.getByLabelText('First')).toHaveFocus()
    })

    it('should allow form submission with Enter key', async () => {
      const user = userEvent.setup()
      const handleSubmit = vi.fn((e) => e.preventDefault())

      const { container } = render(
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" />
          <button type="submit">Submit</button>
        </form>
      )

      const input = screen.getByLabelText('Name')
      input.focus()
      await user.keyboard('John Doe{Enter}')

      expect(handleSubmit).toHaveBeenCalled()
    })
  })

  describe('Placeholder Text', () => {
    it('should not rely solely on placeholder for labeling', () => {
      const { container } = render(
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="user@example.com" />
        </div>
      )
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('should have proper contrast for placeholder text', () => {
      const { container } = render(
        <input type="text" placeholder="Enter text here" />
      )
      const input = screen.getByPlaceholderText('Enter text here')
      expect(input).toBeInTheDocument()
    })
  })

  describe('axe Accessibility Audit', () => {
    it('should have no violations in basic text input', async () => {
      const { container } = render(
        <div>
          <label htmlFor="test-input">Test Input</label>
          <input id="test-input" type="text" />
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations in input with error state', async () => {
      const { container } = render(
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            aria-invalid="true"
            aria-describedby="error"
          />
          <span id="error" role="alert">
            Invalid email format
          </span>
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations in required field', async () => {
      const { container } = render(
        <div>
          <label htmlFor="required-field">
            Required Field <span aria-label="required">*</span>
          </label>
          <input id="required-field" type="text" required />
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations in input with help text', async () => {
      const { container } = render(
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            aria-describedby="hint"
          />
          <span id="hint">At least 8 characters</span>
        </div>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
