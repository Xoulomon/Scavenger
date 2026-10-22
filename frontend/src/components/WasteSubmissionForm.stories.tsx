import type { Meta, StoryObj } from '@storybook/react'
import { userEvent, within, expect } from '@storybook/test'
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The form renders with a submit button
    const submitBtn = canvas.getByRole('button', { name: /submit waste/i })
    await expect(submitBtn).toBeInTheDocument()
    // The cancel button is also present
    const cancelBtn = canvas.getByRole('button', { name: /cancel/i })
    await expect(cancelBtn).toBeInTheDocument()
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const submitBtn = canvas.getByRole('button', { name: /submit waste/i })
    await expect(submitBtn).toBeInTheDocument()
    // Attempt to submit the empty form to trigger validation errors
    await userEvent.click(submitBtn)
  },
}

export const FastSubmission: Story = {
  args: {
    onSubmit: async (data) => {
      console.log('Submitted:', data)
    },
    onCancel: () => console.log('Cancelled'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cancelBtn = canvas.getByRole('button', { name: /cancel/i })
    await expect(cancelBtn).toBeEnabled()
    await userEvent.click(cancelBtn)
  },
}
