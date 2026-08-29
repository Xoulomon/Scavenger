import type { Meta, StoryObj } from '@storybook/react'
import { ErrorState } from '.'

const meta: Meta<typeof ErrorState> = {
  title: 'UI/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ErrorState>

export const Default: Story = {
  args: {
    title: 'Error Loading Data',
    message: 'Failed to fetch the requested data. Please try again.',
  },
}

export const WithAction: Story = {
  args: {
    title: 'Connection Error',
    message: 'Unable to connect to the server. Check your internet connection and try again.',
    action: {
      label: 'Retry',
      onClick: () => console.log('Retry clicked'),
    },
  },
}

export const NotFound: Story = {
  args: {
    title: 'Not Found',
    message: 'The page you are looking for does not exist.',
    action: {
      label: 'Go Back',
      onClick: () => console.log('Go back clicked'),
    },
  },
}
