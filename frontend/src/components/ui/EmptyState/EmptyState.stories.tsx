import type { Meta, StoryObj } from '@storybook/react'
import { Package, Search, Inbox, AlertTriangle } from 'lucide-react'
import { EmptyState } from './index'

const meta: Meta<typeof EmptyState> = {
  title: 'Design System/EmptyState',
  component: EmptyState,
  tags: ['autodocs']
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    icon: Package,
    title: 'No waste submissions yet',
    description: 'Start by submitting recyclable materials to earn tokens.'
  }
}

export const WithAction: Story = {
  args: {
    icon: Inbox,
    title: 'No messages',
    description: 'Your inbox is empty. Messages from collectors will appear here.',
    action: {
      label: 'Browse Collectors',
      onClick: () => {}
    }
  }
}

export const SearchEmpty: Story = {
  args: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
    action: {
      label: 'Clear Filters',
      onClick: () => {}
    }
  }
}

export const ErrorState: Story = {
  args: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'We could not load your data. Please try again.',
    action: {
      label: 'Retry',
      onClick: () => {}
    }
  }
}

export const NoIcon: Story = {
  args: {
    title: 'Nothing here yet',
    description: 'Check back later for updates.'
  }
}
