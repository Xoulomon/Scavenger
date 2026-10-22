import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/Dialog'

describe('Modal accessibility requirements (#1468)', () => {
  describe('labelling', () => {
    it('labels the dialog with its title via aria-labelledby', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register waste</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const dialog = screen.getByRole('dialog', { name: 'Register waste' })
      const labelId = dialog.getAttribute('aria-labelledby')

      expect(labelId).toBeTruthy()
      expect(document.getElementById(labelId as string)).toHaveTextContent('Register waste')
    })

    it('describes the dialog via aria-describedby when a description is present', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer waste</DialogTitle>
              <DialogDescription>Choose a recipient for this batch.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const dialog = screen.getByRole('dialog', { name: 'Transfer waste' })
      const describedById = dialog.getAttribute('aria-describedby')

      expect(describedById).toBeTruthy()
      expect(document.getElementById(describedById as string)).toHaveTextContent(
        'Choose a recipient for this batch.'
      )
    })
  })

  describe('focus management', () => {
    it('moves focus into the dialog when it opens', async () => {
      const user = userEvent.setup()

      render(
        <Dialog>
          <DialogTrigger>Open details</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Details</DialogTitle>
            </DialogHeader>
            <button>Save details</button>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByRole('button', { name: 'Open details' }))

      await waitFor(() => {
        const dialog = screen.getByRole('dialog', { name: 'Details' })
        expect(dialog.contains(document.activeElement)).toBe(true)
      })
    })

    it('returns focus to the trigger when closed with the close control', async () => {
      const user = userEvent.setup()

      render(
        <Dialog>
          <DialogTrigger>Open settings</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <DialogClose>Dismiss</DialogClose>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByRole('button', { name: 'Open settings' })
      await user.click(trigger)
      await user.click(await screen.findByRole('button', { name: 'Dismiss' }))

      await waitFor(() => {
        expect(trigger).toHaveFocus()
      })
    })
  })

  describe('keyboard', () => {
    it('closes on Escape and removes the dialog from the document', async () => {
      const user = userEvent.setup()

      render(
        <Dialog>
          <DialogTrigger>Open confirm</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm action</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByRole('button', { name: 'Open confirm' }))
      expect(await screen.findByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument()

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument()
      })
    })
  })
})
