import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './index'

const meta: Meta<typeof Badge> = {
  title: 'Design System/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline']
    }
  }
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { children: 'Verified', variant: 'default' }
}

export const Secondary: Story = {
  args: { children: 'Pending', variant: 'secondary' }
}

export const Destructive: Story = {
  args: { children: 'Rejected', variant: 'destructive' }
}

export const Outline: Story = {
  args: { children: 'Draft', variant: 'outline' }
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Verified</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  )
}

export const WasteTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {['Plastic', 'Metal', 'Glass', 'Paper', 'E-Waste', 'Organic'].map((type) => (
        <Badge key={type} variant="secondary">
          {type}
        </Badge>
      ))}
    </div>
  )
}
