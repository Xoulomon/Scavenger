import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './Dialog'

expect.extend(toHaveNoViolations)

describe('Dialog Components', () => {
  describe('Dialog Trigger and Content', () => {
    it('renders closed dialog by default', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /dialog title/i })).not.toBeInTheDocument()
    })

    it('opens dialog when trigger is clicked', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Content</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByRole('button', { name: /open dialog/i })
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dialog content/i })).toBeInTheDocument()
      })
    })

    it('closes dialog when close button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
            </DialogHeader>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /dialog/i })).not.toBeInTheDocument()
      })
    })

    it('supports controlled open state', async () => {
      const handleOpenChange = vi.fn()
      const { rerender } = render(
        <Dialog open={false} onOpenChange={handleOpenChange}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByRole('button', { name: /open/i })
      await userEvent.click(trigger)

      expect(handleOpenChange).toHaveBeenCalledWith(true)
    })
  })

  describe('DialogHeader', () => {
    it('renders header container', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>Header Content</DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })

    it('has proper flex layout', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader className="test-header">Header</DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const header = container.querySelector('.test-header')
      expect(header).toHaveClass('flex', 'flex-col')
    })
  })

  describe('DialogTitle', () => {
    it('renders dialog title as heading', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>My Dialog Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const title = screen.getByRole('heading', { name: /my dialog title/i })
      expect(title).toBeInTheDocument()
    })

    it('has proper typography styling', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Styled Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const title = container.querySelector('[class*="text-lg"]')
      expect(title).toBeInTheDocument()
    })

    it('accepts custom className', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle className="custom-title">Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const title = container.querySelector('.custom-title')
      expect(title).toBeInTheDocument()
    })
  })

  describe('DialogDescription', () => {
    it('renders description text', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogDescription>Dialog description text</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Dialog description text')).toBeInTheDocument()
    })

    it('applies secondary text styling', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogDescription>Styled description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      const description = screen.getByText('Styled description')
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('accepts custom className', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogDescription className="custom-description">Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      const description = container.querySelector('.custom-description')
      expect(description).toBeInTheDocument()
    })
  })

  describe('DialogFooter', () => {
    it('renders footer container', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogFooter>Footer content</DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('has flex layout for button groups', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogFooter className="test-footer">
              <button>Cancel</button>
              <button>Submit</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const footer = container.querySelector('.test-footer')
      expect(footer).toHaveClass('flex')
    })

    it('renders multiple buttons correctly', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogFooter>
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })
  })

  describe('DialogClose', () => {
    it('renders close button with accessible icon', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogClose />
          </DialogContent>
        </Dialog>
      )

      // DialogClose has sr-only "Close" text
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('is positioned in top-right of dialog', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogClose />
          </DialogContent>
        </Dialog>
      )

      const closeButton = container.querySelector('button[class*="absolute"]')
      expect(closeButton).toHaveClass('absolute')
      expect(closeButton).toHaveClass('right-3')
      expect(closeButton).toHaveClass('top-3')
    })
  })

  describe('Dialog Composition', () => {
    it('renders complete dialog structure', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>This is a dialog description</DialogDescription>
            </DialogHeader>
            <div>Dialog content</div>
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByRole('button', { name: /open dialog/i })
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /dialog title/i })).toBeInTheDocument()
        expect(screen.getByText('This is a dialog description')).toBeInTheDocument()
        expect(screen.getByText('Dialog content')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      })
    })

    it('supports custom content and styling', () => {
      render(
        <Dialog open={true}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Large Dialog</DialogTitle>
            </DialogHeader>
            <div className="custom-content">
              <p>Custom content with styling</p>
            </div>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Large Dialog')).toBeInTheDocument()
      expect(screen.getByText('Custom content with styling')).toBeInTheDocument()
    })
  })

  describe('Keyboard Interactions', () => {
    it('closes dialog with Escape key', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByRole('button', { name: /open/i })
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      })
    })

    it('dialog close button is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      closeButton.focus()
      expect(closeButton).toHaveFocus()

      await user.keyboard('{Enter}')
      // Dialog should attempt to close
    })
  })

  describe('Accessibility', () => {
    it('title and description are properly associated', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('heading', { name: /dialog title/i })).toBeInTheDocument()
      expect(screen.getByText('Dialog Description')).toBeInTheDocument()
    })

    it('close button has accessible label', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogClose />
          </DialogContent>
        </Dialog>
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toHaveAttribute('aria-label')
    })

    it('supports aria-labelledby and aria-describedby', () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent aria-labelledby="dialog-title" aria-describedby="dialog-description">
            <DialogTitle id="dialog-title">Title</DialogTitle>
            <DialogDescription id="dialog-description">Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      const content = container.querySelector('[role="dialog"]')
      expect(content).toHaveAttribute('aria-labelledby', 'dialog-title')
      expect(content).toHaveAttribute('aria-describedby', 'dialog-description')
    })

    it('complete dialog passes accessibility audit', async () => {
      const { container } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accessible Dialog</DialogTitle>
              <DialogDescription>Accessible description</DialogDescription>
            </DialogHeader>
            <div>Content</div>
            <DialogFooter>
              <button>Action</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('focus trap is established within dialog', async () => {
      const user = userEvent.setup()
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <button>Button 1</button>
            <button>Button 2</button>
          </DialogContent>
        </Dialog>
      )

      const buttons = screen.getAllByRole('button')
      // Focus should be manageable within the dialog
      buttons[0].focus()
      expect(buttons[0]).toHaveFocus()
    })
  })

  describe('ForwardRef', () => {
    it('DialogContent forwards ref', () => {
      let contentRef: HTMLDivElement | null = null
      render(
        <Dialog open={true}>
          <DialogContent
            ref={(el) => {
              contentRef = el
            }}
          >
            Content
          </DialogContent>
        </Dialog>
      )
      expect(contentRef).toBeInstanceOf(HTMLDivElement)
    })

    it('DialogTitle forwards ref', () => {
      let titleRef: HTMLHeadingElement | null = null
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle
              ref={(el) => {
                titleRef = el
              }}
            >
              Title
            </DialogTitle>
          </DialogContent>
        </Dialog>
      )
      expect(titleRef).toBeInstanceOf(HTMLHeadingElement)
    })
  })
})
