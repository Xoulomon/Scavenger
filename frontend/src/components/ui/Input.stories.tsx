import type { Meta, StoryObj } from '@storybook/react'
import { Search } from 'lucide-react'
import { Input } from './Input'

const meta: Meta<typeof Input> = {
  title: 'Design System/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'password', 'number', 'search'] }
  }
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { placeholder: 'Enter wallet address…' }
}

export const WithValue: Story = {
  args: { defaultValue: '0xABCD1234…', placeholder: 'Wallet address' }
}

export const Disabled: Story = {
  args: { placeholder: 'Disabled input', disabled: true }
}

export const Password: Story = {
  args: { type: 'password', placeholder: 'Enter password' }
}

export const Number: Story = {
  args: { type: 'number', placeholder: 'Weight (kg)', min: 0, step: 0.1 }
}

export const WithIcon: Story = {
  render: () => (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Search waste items…" />
    </div>
  )
}

export const FormField: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor="weight">
        Weight (kg)
      </label>
      <Input id="weight" type="number" placeholder="0.0" min={0} step={0.1} />
      <p className="text-xs text-muted-foreground">
        Enter the total weight of recyclable material.
      </p>
    </div>
  )
}
