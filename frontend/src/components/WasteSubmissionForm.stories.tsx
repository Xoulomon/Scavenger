import type { Meta, StoryObj } from '@storybook/react'
import { WasteSubmissionForm } from './WasteSubmissionForm'

const meta: Meta<typeof WasteSubmissionForm> = {
  title: 'Forms/WasteSubmissionForm',
  component: WasteSubmissionForm,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof WasteSubmissionForm>

export const Default: Story = {
  args: {
    onSubmit: async (data) => {
      await new Promise((r) => setTimeout(r, 1500))
      console.log('Submitted:', data)
    },
    onCancel: () => console.log('Cancelled'),
  },
}

export const SubmissionError: Story = {
  args: {
    onSubmit: async () => {
      await new Promise((r) => setTimeout(r, 1000))
      throw new Error('Network error: could not reach server.')
    },
    onCancel: () => console.log('Cancelled'),
  },
}

export const FastSubmission: Story = {
  args: {
    onSubmit: async (data) => {
      console.log('Submitted:', data)
    },
    onCancel: () => console.log('Cancelled'),
  },
}
