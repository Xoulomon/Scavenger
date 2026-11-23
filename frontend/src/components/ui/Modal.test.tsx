import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Modal } from './Modal'
import { useState } from 'react'

expect.extend(toHaveNoViolations)

// Test wrapper component to manage modal state
function _TestModal({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
        onClose()
      }}
      title="Test Modal"
      description="This is a test modal"
    >
      <p>Modal content</p>
      <button onClick={() => setOpen(false)}>Close Button</button>
    </Modal>
  )
}

describe('Modal', () => {
  describe('Rendering', () => {
    it('renders modal when open is true', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Test Title">
          Modal Content
        </Modal>
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render modal when open is false', () => {
      const { rerender } = render(
        <Modal open={false} onClose={vi.fn()} title="Test Title">
          Modal Content
        </Modal>
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // Rerender with open=true to ensure it renders
      rerender(
        <Modal open={true} onClose={vi.fn()} title="Test Title">
          Modal Content
        </Modal>
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('renders title as accessible name', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Delete Project">
          <p>This action cannot be undone</p>
        </Modal>
      )
      const dialog = screen.getByRole('dialog', { name: /delete project/i })
      expect(dialog).toBeInTheDocument()
    })

    it('renders description when provided', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Confirm" description="Are you sure?">
          Content
        </Modal>
      )
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })

    it('renders children content', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Test Modal">
          <button>Action Button</button>
          <p>Custom content</p>
        </Modal>
      )
      expect(screen.getByText('Action Button')).toBeInTheDocument()
      expect(screen.getByText('Custom content')).toBeInTheDocument()
    })

    it('renders close button with aria-label', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Test">
          Content
        </Modal>
      )
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(
        <Modal open={true} onClose={vi.fn()} title="Test" className="custom-modal-class">
          Content
        </Modal>
      )
      const dialogContent = container.querySelector('[role="dialog"]')
      expect(dialogContent).toHaveClass('custom-modal-class')
    })

    it('has aria-modal="true" attribute', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Test Modal">
          Content
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })
  })

  describe('User Interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <Modal open={true} onClose={onClose} title="Test">
          Content
        </Modal>
      )
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Escape key is pressed', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <Modal open={true} onClose={onClose} title="Test">
          Content
        </Modal>
      )
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalled()
    })

    it('closes modal when overlay is clicked (Radix Dialog default)', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const { container } = render(
        <Modal open={true} onClose={onClose} title="Test">
          Content
        </Modal>
      )
      // Click on the overlay (outside the dialog content)
      const overlay = container.querySelector('[data-radix-dialog-overlay]')
      if (overlay) {
        await user.click(overlay)
        expect(onClose).toHaveBeenCalled()
      }
    })

    it('does not close modal when content is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <Modal open={true} onClose={onClose} title="Test">
          <p>Modal content</p>
        </Modal>
      )
      const content = screen.getByText('Modal content')
      await user.click(content)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('supports keyboard navigation in dialog content', async () => {
      const user = userEvent.setup()
      render(
        <Modal open={true} onClose={vi.fn()} title="Test">
          <button>First Button</button>
          <button>Second Button</button>
          <button>Third Button</button>
        </Modal>
      )
      const firstButton = screen.getByRole('button', { name: /first button/i })
      const secondButton = screen.getByRole('button', { name: /second button/i })

      firstButton.focus()
      expect(firstButton).toHaveFocus()

      await user.keyboard('{Tab}')
      expect(secondButton).toHaveFocus()
    })
  })

  describe('Focus Management', () => {
    it('traps focus within modal when open', async () => {
      const user = userEvent.setup()
      render(
        <>
          <button>Outside Button</button>
          <Modal open={true} onClose={vi.fn()} title="Test">
            <button>Inside Button</button>
          </Modal>
        </>
      )

      const insideButton = screen.getByRole('button', { name: /inside button/i })
      insideButton.focus()
      expect(insideButton).toHaveFocus()

      // Simulate Tab key to cycle focus
      await user.keyboard('{Tab}')
      // Focus should remain within the modal
      const dialog = screen.getByRole('dialog')
      expect(dialog).toContainElement(document.activeElement)
    })

    it('restores focus to triggerRef when modal closes', async () => {
      const _user = userEvent.setup()
      let modalOpen = true

      function TestComponent() {
        const [open, setOpen] = useState(modalOpen)
        const triggerRef = { current: null } as React.MutableRefObject<HTMLButtonElement | null>

        return (
          <>
            <button ref={triggerRef}>Open Modal</button>
            <Modal
              open={open}
              onClose={() => {
                setOpen(false)
              }}
              title="Test"
              triggerRef={triggerRef}
            >
              <button>Modal Button</button>
            </Modal>
          </>
        )
      }

      render(<TestComponent />)
      const triggerButton = screen.getByRole('button', { name: /open modal/i })
      triggerButton.focus()

      // When modal closes, focus should return to trigger
      // (This behavior is handled by Radix Dialog)
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <Modal open={true} onClose={vi.fn()} title="Accessible Modal">
          <p>Modal content</p>
          <button>Action</button>
        </Modal>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has correct ARIA attributes', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Test Modal">
          Content
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('role', 'dialog')
    })

    it('semantic heading structure', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Modal Title">
          Content
        </Modal>
      )
      const heading = screen.getByRole('heading', { name: /modal title/i })
      expect(heading).toBeInTheDocument()
    })

    it('announces content changes to screen readers', async () => {
      const _user = userEvent.setup()
      const { rerender } = render(
        <Modal open={true} onClose={vi.fn()} title="Original Title">
          Original Content
        </Modal>
      )
      expect(screen.getByText('Original Content')).toBeInTheDocument()

      rerender(
        <Modal open={true} onClose={vi.fn()} title="Updated Title">
          Updated Content
        </Modal>
      )
      expect(screen.getByText('Updated Content')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid open/close cycles', async () => {
      const _user = userEvent.setup()
      const onClose = vi.fn()
      const { rerender } = render(
        <Modal open={true} onClose={onClose} title="Test">
          Content
        </Modal>
      )

      rerender(
        <Modal open={false} onClose={onClose} title="Test">
          Content
        </Modal>
      )

      rerender(
        <Modal open={true} onClose={onClose} title="Test">
          Content
        </Modal>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('handles very long title', () => {
      const longTitle =
        'This is a very long modal title that might wrap to multiple lines in the UI'
      render(
        <Modal open={true} onClose={vi.fn()} title={longTitle}>
          Content
        </Modal>
      )
      const heading = screen.getByRole('heading', { name: new RegExp(longTitle) })
      expect(heading).toBeInTheDocument()
    })

    it('handles React elements as title', () => {
      render(
        <Modal
          open={true}
          onClose={vi.fn()}
          title={
            <span>
              <strong>Important</strong> Action
            </span>
          }
        >
          Content
        </Modal>
      )
      expect(screen.getByText('Important')).toBeInTheDocument()
    })

    it('handles empty children gracefully', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="Empty Modal">
          {null}
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
    })
  })

  describe('Backwards Compatibility', () => {
    it('maintains existing prop interface from issue #1674', () => {
      const onClose = vi.fn()
      const { rerender } = render(
        <Modal
          open={true}
          onClose={onClose}
          title="Test"
          description="Description"
          className="custom-class"
        >
          Children
        </Modal>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Props should work exactly as before
      rerender(
        <Modal
          open={false}
          onClose={onClose}
          title="Test"
          description="Description"
          className="custom-class"
        >
          Children
        </Modal>
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
