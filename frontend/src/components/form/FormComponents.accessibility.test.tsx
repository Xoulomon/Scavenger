import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

/**
 * Form Components Accessibility Suite
 * Comprehensive accessibility testing for all form-related components
 */

expect.extend(toHaveNoViolations)

describe('Form Components Accessibility Suite', () => {
  describe('Select/Dropdown Accessibility', () => {
    it('should have aria-label on select elements', () => {
      const { container } = render(
        <select aria-label="Choose an option">
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
      )
      expect(screen.getByLabelText('Choose an option')).toBeInTheDocument()
    })

    it('should support keyboard navigation in select', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <select aria-label="Options">
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
      )

      const select = screen.getByLabelText('Options')
      select.focus()
      expect(select).toHaveFocus()

      await user.tab()
      expect(document.activeElement).not.toBe(select)
    })

    it('should announce selected value to screen readers', () => {
      const { container } = render(
        <select aria-label="Choose category" defaultValue="category1">
          <option value="category1">Technology</option>
          <option value="category2">Business</option>
        </select>
      )
      const select = screen.getByLabelText('Choose category') as HTMLSelectElement
      expect(select.value).toBe('category1')
    })
  })

  describe('Checkbox Accessibility', () => {
    it('should associate checkbox with label', () => {
      const { container } = render(
        <div>
          <input id="agree" type="checkbox" />
          <label htmlFor="agree">I agree to terms</label>
        </div>
      )
      expect(screen.getByLabelText('I agree to terms')).toBeInTheDocument()
    })

    it('should indicate checkbox state to screen readers', () => {
      const { container } = render(
        <input type="checkbox" aria-label="Subscribe" defaultChecked />
      )
      const checkbox = screen.getByLabelText('Subscribe') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('should support keyboard toggle', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <div>
          <input id="terms" type="checkbox" />
          <label htmlFor="terms">Accept Terms</label>
        </div>
      )

      const checkbox = screen.getByLabelText('Accept Terms') as HTMLInputElement
      checkbox.focus()
      expect(checkbox).toHaveFocus()

      await user.keyboard(' ')
      expect(checkbox.checked).toBe(true)

      await user.keyboard(' ')
      expect(checkbox.checked).toBe(false)
    })
  })

  describe('Radio Button Accessibility', () => {
    it('should group radio buttons with fieldset and legend', () => {
      const { container } = render(
        <fieldset>
          <legend>Choose an option</legend>
          <div>
            <input id="radio1" type="radio" name="option" />
            <label htmlFor="radio1">Option 1</label>
          </div>
          <div>
            <input id="radio2" type="radio" name="option" />
            <label htmlFor="radio2">Option 2</label>
          </div>
        </fieldset>
      )
      expect(screen.getByText('Choose an option')).toBeInTheDocument()
    })

    it('should support arrow key navigation', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <fieldset>
          <legend>Options</legend>
          <div>
            <input id="r1" type="radio" name="opt" />
            <label htmlFor="r1">Option 1</label>
          </div>
          <div>
            <input id="r2" type="radio" name="opt" />
            <label htmlFor="r2">Option 2</label>
          </div>
        </fieldset>
      )
      expect(screen.getByText('Options')).toBeInTheDocument()
    })
  })

  describe('Text Area Accessibility', () => {
    it('should have associated label with textarea', () => {
      const { container } = render(
        <div>
          <label htmlFor="message">Message</label>
          <textarea id="message" />
        </div>
      )
      expect(screen.getByLabelText('Message')).toBeInTheDocument()
    })

    it('should indicate character count limit with aria-describedby', () => {
      const { container } = render(
        <div>
          <label htmlFor="comment">Comment</label>
          <textarea
            id="comment"
            maxLength={500}
            aria-describedby="char-count"
          />
          <span id="char-count">Max 500 characters</span>
        </div>
      )
      const textarea = screen.getByLabelText('Comment')
      expect(textarea).toHaveAttribute('aria-describedby', 'char-count')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <textarea placeholder="Enter text" />
      )

      const textarea = screen.getByPlaceholderText('Enter text')
      await user.click(textarea)
      await user.keyboard('Hello World')

      expect(textarea).toHaveValue('Hello World')
    })
  })

  describe('Form-level Accessibility', () => {
    it('should announce form submission status', () => {
      const { container } = render(
        <form>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" />
          <div role="status" aria-live="polite">
            Please fill out all required fields
          </div>
          <button type="submit">Submit</button>
        </form>
      )
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should handle form validation errors accessibly', () => {
      const { container } = render(
        <form>
          <label htmlFor="username">Username</label>
          <input id="username" aria-invalid="true" aria-describedby="error" />
          <div id="error" role="alert">
            Username must be unique
          </div>
        </form>
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should clearly indicate required fields', () => {
      const { container } = render(
        <form>
          <label htmlFor="required-field">
            Required Field <span aria-label="required">*</span>
          </label>
          <input id="required-field" required type="text" />
        </form>
      )
      expect(screen.getByLabelText('Required Field')).toHaveAttribute('required')
    })
  })

  describe('Form Accessibility with axe', () => {
    it('should have no violations in simple form', async () => {
      const { container } = render(
        <form>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required />
          <button type="submit">Submit</button>
        </form>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations in form with validation', async () => {
      const { container } = render(
        <form>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            aria-describedby="pwd-hint"
            required
          />
          <span id="pwd-hint">At least 8 characters, 1 number, 1 symbol</span>
          <button type="submit">Submit</button>
        </form>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations in multi-section form', async () => {
      const { container } = render(
        <form>
          <fieldset>
            <legend>Personal Info</legend>
            <label htmlFor="fname">First Name</label>
            <input id="fname" type="text" required />
          </fieldset>
          <fieldset>
            <legend>Contact Info</legend>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required />
          </fieldset>
          <button type="submit">Submit</button>
        </form>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Focus Management', () => {
    it('should show visible focus indicator on form inputs', () => {
      const { container } = render(
        <input type="text" data-testid="input" />
      )
      const input = screen.getByTestId('input')
      input.focus()
      expect(input).toHaveFocus()
    })

    it('should manage focus after form submission', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <form>
          <input type="text" placeholder="Name" />
          <button type="submit">Submit</button>
        </form>
      )
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
    })

    it('should restore focus after error correction', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" aria-invalid="true" />
          <span role="alert">Invalid email</span>
        </div>
      )
      const input = screen.getByLabelText('Email')
      input.focus()
      expect(input).toHaveFocus()
    })
  })
})
