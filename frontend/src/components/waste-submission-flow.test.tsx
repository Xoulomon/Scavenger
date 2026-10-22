import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WasteSubmissionForm } from '@/components/WasteSubmissionForm'

const srcDir = resolve(__dirname, '..')

describe('waste submission flow (#1467)', () => {
  describe('WasteSubmissionForm', () => {
    it('renders the form with a Cancel action', () => {
      render(<WasteSubmissionForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('calls onCancel when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      render(<WasteSubmissionForm onSubmit={vi.fn()} onCancel={onCancel} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('single flow', () => {
    it.fails('keeps only one submission flow: the step-based wizard is removed', () => {
      // Fails while components/wizard/WasteSubmissionWizard.tsx still exists.
      // Once the duplicate is deleted this assertion passes, so remove the `.fails`.
      expect(existsSync(resolve(srcDir, 'wizard/WasteSubmissionWizard.tsx'))).toBe(false)
    })
  })
})
