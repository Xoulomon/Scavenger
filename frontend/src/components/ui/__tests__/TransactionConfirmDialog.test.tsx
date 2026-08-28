import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { TransactionConfirmDialog } from '../TransactionConfirmDialog'

expect.extend(toHaveNoViolations)

const baseProps = {
  open: true,
  action: 'Transfer Waste',
  params: [
    { label: 'Waste ID', value: '#42' },
    { label: 'From', value: 'GFROM...' },
    { label: 'To', value: 'GTO...' },
  ],
  isPending: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('TransactionConfirmDialog', () => {
  describe('Rendering', () => {
    it('renders nothing when open=false', () => {
      render(<TransactionConfirmDialog {...baseProps} open={false} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog when open=true', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('renders "Confirm Transaction" title', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      expect(screen.getByText(/confirm transaction/i)).toBeInTheDocument()
    })

    it('renders action name in params table', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      expect(screen.getByText('Transfer Waste')).toBeInTheDocument()
    })

    it('renders all params rows', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      expect(screen.getByText('Waste ID')).toBeInTheDocument()
      expect(screen.getByText('#42')).toBeInTheDocument()
      expect(screen.getByText('From')).toBeInTheDocument()
      expect(screen.getByText('To')).toBeInTheDocument()
    })

    it('renders estimated fee with default value', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      expect(screen.getByText('~0.00001 XLM')).toBeInTheDocument()
    })

    it('renders custom estimated fee', () => {
      render(<TransactionConfirmDialog {...baseProps} estimatedFee="~0.001 XLM" />)
      expect(screen.getByText('~0.001 XLM')).toBeInTheDocument()
    })

    it('renders "Confirm & Sign" button when not pending', () => {
      render(<TransactionConfirmDialog {...baseProps} isPending={false} />)
      expect(screen.getByRole('button', { name: /confirm & sign/i })).toBeInTheDocument()
    })

    it('renders "Pending…" state when isPending=true', () => {
      render(<TransactionConfirmDialog {...baseProps} isPending={true} />)
      expect(screen.getByText(/pending/i)).toBeInTheDocument()
    })

    it('disables both buttons when isPending=true', () => {
      render(<TransactionConfirmDialog {...baseProps} isPending={true} />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => expect(btn).toBeDisabled())
    })

    it('renders Cancel button', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onConfirm when Confirm & Sign button clicked', async () => {
      const onConfirm = vi.fn()
      render(<TransactionConfirmDialog {...baseProps} onConfirm={onConfirm} />)
      await userEvent.click(screen.getByRole('button', { name: /confirm & sign/i }))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onCancel when Cancel button clicked', async () => {
      const onCancel = vi.fn()
      render(<TransactionConfirmDialog {...baseProps} onCancel={onCancel} />)
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('does not call onCancel when pending and dialog close is attempted', async () => {
      // isPending=true means onCancel should not fire on dialog close attempt
      const onCancel = vi.fn()
      render(
        <TransactionConfirmDialog {...baseProps} isPending={true} onCancel={onCancel} />
      )
      await userEvent.keyboard('{Escape}')
      // Because isPending is true, onOpenChange guard prevents onCancel
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('dialog has accessible title', () => {
      render(<TransactionConfirmDialog {...baseProps} />)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAccessibleName(/confirm transaction/i)
    })

    it('passes axe audit', async () => {
      const { container } = render(<TransactionConfirmDialog {...baseProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit in pending state', async () => {
      const { container } = render(
        <TransactionConfirmDialog {...baseProps} isPending={true} />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
