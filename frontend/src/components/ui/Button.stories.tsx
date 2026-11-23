import type { Meta, StoryObj } from '@storybook/react'
import { Loader2, Recycle } from 'lucide-react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link']
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
    disabled: { control: 'boolean' }
  }
}
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: { children: 'Submit Waste', variant: 'primary' }
}

export const Secondary: Story = {
  args: { children: 'View Details', variant: 'secondary' }
}

export const Outline: Story = {
  args: { children: 'Cancel', variant: 'outline' }
}

export const Ghost: Story = {
  args: { children: 'Learn More', variant: 'ghost' }
}

export const Destructive: Story = {
  args: { children: 'Delete', variant: 'destructive' }
}

export const Link: Story = {
  args: { children: 'View on chain', variant: 'link' }
}

export const Disabled: Story = {
  args: { children: 'Unavailable', disabled: true }
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Recycle className="mr-2 h-4 w-4" />
        Recycle Now
      </>
    )
  }
}

export const Loading: Story = {
  args: {
    children: (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Processing…
      </>
    ),
    disabled: true
  }
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  )
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  )
}
