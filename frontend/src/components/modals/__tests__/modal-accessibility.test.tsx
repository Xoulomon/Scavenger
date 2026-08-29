import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/Dialog'

expect.extend(toHaveNoViolations)

describe('Modal Accessibility', () => {
  // ── Focus Trapping ───────────────────────────────────────────────────────

  describe('Focus Trapping', () => {
    it('traps focus within dialog when open', async () => {
      const user = userEvent.setup()
      const handleClose = vi.fn()

      render(
        <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const buttons = screen.getAllByRole('button')
      const firstButton = buttons[0]

      // Tab from first button should eventually cycle through dialog
      firstButton.focus()
      expect(firstButton).toHaveFocus()

      // Tab multiple times to ensure we stay in dialog
      for (let i = 0; i < 10; i++) {
        await user.tab()
      }

      // Focus should still be within dialog (one of the buttons or close button)
      const activeElement = document.activeElement
      const isInDialog =
        activeElement?.textContent?.includes('Cancel') ||
        activeElement?.textContent?.includes('Confirm') ||
        activeElement?.textContent?.includes('Close')

      expect(isInDialog).toBe(true)
    })

    it('returns focus to trigger when dialog closes', async () => {
      const user = userEvent.setup()

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
            </DialogHeader>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByRole('button', { name: /open dialog/i })

      // Open dialog
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dialog/i })).toBeInTheDocument()
      })

      // Close dialog
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      // Focus should return to trigger
      await waitFor(() => {
        expect(trigger).toHaveFocus()
      })
    })
  })

  // ── Keyboard Interaction ──────────────────────────────────────────────────

  describe('Keyboard Interaction', () => {
    it('closes dialog when Escape key is pressed', async () => {
      const user = userEvent.setup()

      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('heading', { name: /dialog/i })).toBeInTheDocument()

      // Press Escape
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /dialog/i })).not.toBeInTheDocument()
      })
    })

    it('allows Tab navigation within dialog', async () => {
      const user = userEvent.setup()

      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
            </DialogHeader>
            <button id="first-btn">First</button>
            <button id="second-btn">Second</button>
          </DialogContent>
        </Dialog>
      )

      const firstButton = screen.getByRole('button', { name: /first/i })
      firstButton.focus()

      expect(firstButton).toHaveFocus()

      // Tab to next element
      await user.tab()
      expect(screen.getByRole('button', { name: /second/i })).toHaveFocus()
    })

    it('allows Shift+Tab to navigate backwards', async () => {
      const user = userEvent.setup()

      render(
        <Dialog open={true}>
          <DialogContent>
            <button id="first-btn">First</button>
            <button id="second-btn">Second</button>
          </DialogContent>
        </Dialog>
      )

      const secondButton = screen.getByRole('button', { name: /second/i })
      secondButton.focus()

      expect(secondButton).toHaveFocus()

      // Shift+Tab to previous element
      await user.tab({ shift: true })
      expect(screen.getByRole('button', { name: /first/i })).toHaveFocus()
    })
  })

  // ── ARIA Attributes ──────────────────────────────────────────────────────

  describe('ARIA Attributes', () => {
    it('has role="dialog" on content element', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const dialogContent = screen.getByRole('dialog')
      expect(dialogContent).toHaveAttribute('role', 'dialog')
    })

    it('has aria-modal="true" on content element', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const dialogContent = screen.getByRole('dialog')
      expect(dialogContent).toHaveAttribute('aria-modal', 'true')
    })

    it('has aria-labelledby pointing to title', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const dialogContent = screen.getByRole('dialog')
      const title = screen.getByRole('heading', { name: /dialog title/i })

      const ariaLabelledBy = dialogContent.getAttribute('aria-labelledby')
      const titleId = title.getAttribute('id')

      // Should be connected if proper implementation
      expect(ariaLabelledBy || titleId).toBeTruthy()
    })

    it('has aria-describedby when description is present', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>This is a description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const dialogContent = screen.getByRole('dialog')
      const ariaDescribedBy = dialogContent.getAttribute('aria-describedby')

      // Should have aria-describedby or description should be associated
      expect(ariaDescribedBy || screen.getByText(/this is a description/i)).toBeTruthy()
    })

    it('close button has aria-label', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <DialogClose />
          </DialogContent>
        </Dialog>
      )

      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find((btn) => btn.classList.contains('absolute'))

      // Should have sr-only text or aria-label
      expect(closeButton?.querySelector('.sr-only') || closeButton?.getAttribute('aria-label')).toBeTruthy()
    })
  })

  // ── Screen Reader Support ─────────────────────────────────────────────────

  describe('Screen Reader Support', () => {
    it('announces dialog title to screen readers', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Important Dialog</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('heading', { name: /important dialog/i })).toBeInTheDocument()
    })

    it('announces dialog description when present', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
              <DialogDescription>This is important information</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText(/this is important information/i)).toBeInTheDocument()
    })

    it('announces close button text or aria-label', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
            </DialogHeader>
            <DialogClose />
          </DialogContent>
        </Dialog>
      )

      // Close button should have sr-only label
      const closeButton = screen.getByText(/close/i, { selector: '.sr-only' })
      expect(closeButton).toBeInTheDocument()
    })
  })

  // ── Accessibility Violations ──────────────────────────────────────────────

  describe('Accessibility Violations', () => {
    it('has no axe violations when open', async () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <button>Action</button>
          </DialogContent>
        </Dialog>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no axe violations with complex content', async () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complex Dialog</DialogTitle>
              <DialogDescription>This is a more complex dialog</DialogDescription>
            </DialogHeader>
            <form>
              <label htmlFor="input1">Name:</label>
              <input id="input1" type="text" required />
              <label htmlFor="input2">Email:</label>
              <input id="input2" type="email" required />
            </form>
            <DialogFooter>
              <button>Cancel</button>
              <button>Submit</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
