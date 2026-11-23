import type { Meta, StoryObj } from '@storybook/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from './Select'

const meta: Meta = {
  title: 'Design System/Select',
  tags: ['autodocs']
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select waste type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="plastic">Plastic</SelectItem>
        <SelectItem value="metal">Metal</SelectItem>
        <SelectItem value="glass">Glass</SelectItem>
        <SelectItem value="paper">Paper</SelectItem>
        <SelectItem value="ewaste">E-Waste</SelectItem>
        <SelectItem value="organic">Organic</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select participant role" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Roles</SelectLabel>
          <SelectItem value="recycler">Recycler</SelectItem>
          <SelectItem value="collector">Collector</SelectItem>
          <SelectItem value="manufacturer">Manufacturer</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Not available" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="x">Option</SelectItem>
      </SelectContent>
    </Select>
  )
}
