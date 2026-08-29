import type { Meta, StoryObj } from '@storybook/react'
import { LoadingState } from '.'

const meta: Meta<typeof LoadingState> = {
  title: 'UI/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof LoadingState>

export const Default: Story = {
  args: {
    message: 'Loading data...',
  },
}

export const Small: Story = {
  args: {
    message: 'Processing...',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    message: 'Loading your dashboard...',
    size: 'lg',
  },
}

export const NoMessage: Story = {
  args: {
    size: 'md',
  },
}
