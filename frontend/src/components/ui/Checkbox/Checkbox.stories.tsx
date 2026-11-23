import type { Meta, StoryObj } from '@storybook/react'
import { Checkbox } from './index'

const meta: Meta<typeof Checkbox> = {
  title: 'Design System/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    defaultChecked: { control: 'boolean' }
  }
}
export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {}

export const Checked: Story = {
  args: { defaultChecked: true }
}

export const Disabled: Story = {
  args: { disabled: true }
}

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true }
}

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <label htmlFor="terms" className="cursor-pointer text-sm font-medium leading-none">
        I agree to the recycling terms and conditions
      </label>
    </div>
  )
}

export const WasteTypeFilter: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">Filter by waste type</p>
      {['Plastic', 'Metal', 'Glass', 'Paper', 'E-Waste'].map((type) => (
        <div key={type} className="flex items-center gap-2">
          <Checkbox id={type} defaultChecked={type === 'Plastic'} />
          <label htmlFor={type} className="cursor-pointer text-sm">
            {type}
          </label>
        </div>
      ))}
    </div>
  )
}
