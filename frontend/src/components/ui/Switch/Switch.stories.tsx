import type { Meta, StoryObj } from '@storybook/react'
import { Switch } from './index'

const meta: Meta<typeof Switch> = {
  title: 'Design System/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    defaultChecked: { control: 'boolean' }
  }
}
export default meta
type Story = StoryObj<typeof Switch>

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
    <div className="flex items-center gap-3">
      <Switch id="notifications" />
      <label htmlFor="notifications" className="cursor-pointer text-sm font-medium">
        Enable push notifications
      </label>
    </div>
  )
}

export const SettingsRow: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4">
      {[
        { id: 'dark-mode', label: 'Dark mode', checked: true },
        { id: 'notifications', label: 'Notifications', checked: false },
        { id: 'analytics', label: 'Share analytics', checked: true }
      ].map(({ id, label, checked }) => (
        <div key={id} className="flex items-center justify-between">
          <label htmlFor={id} className="cursor-pointer text-sm">
            {label}
          </label>
          <Switch id={id} defaultChecked={checked} />
        </div>
      ))}
    </div>
  )
}
