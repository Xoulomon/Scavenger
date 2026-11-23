import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './Dialog'

const meta: Meta = {
  title: 'Design System/Dialog',
  tags: ['autodocs']
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Waste Transfer</DialogTitle>
          <DialogDescription>
            You are about to transfer 5.2 kg of plastic to Collector 0xABCD…1234. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Waste Entry</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Waste Entry</DialogTitle>
          <DialogDescription>
            This will permanently remove the waste entry from the blockchain. This action cannot be
            reversed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
