import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverviewTab } from '../OverviewTab'
import { UsersTab } from '../UsersTab'
import { DisputesTab } from '../DisputesTab'
import { ConfigTab } from '../ConfigTab'
import { AuditLogTab } from '../AuditLogTab'
import { SystemHealthTab } from '../SystemHealthTab'
import { MOCK_USERS, MOCK_DISPUTES } from '../mockData'
import { addAuditEntry } from '../auditLog'

vi.mock('@/hooks/useAdminDashboard', () => ({
  useAdminMetrics: () => ({
    data: { total_wastes_count: 42, total_tokens_earned: 1000n },
    isLoading: false,
  }),
  useAdminIncentives: () => ({
    data: [],
    isLoading: false,
  }),
  useAdminWasteLookup: () => ({
    data: null,
    isLoading: false,
  }),
}))

describe('Admin Tab Components', () => {
  describe('OverviewTab', () => {
    it('renders metrics and user count correctly', () => {
      render(<OverviewTab registeredUsersCount={10} />)
      expect(screen.getByText('Total Wastes')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('Total Tokens Earned')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('Registered Users')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  describe('UsersTab', () => {
    it('renders user list and filters by name', () => {
      render(<UsersTab initialUsers={MOCK_USERS} />)
      expect(screen.getByText('Alice Green')).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()

      const input = screen.getByPlaceholderText('Search by name, address or role…')
      fireEvent.change(input, { target: { value: 'Alice' } })

      expect(screen.getByText('Alice Green')).toBeInTheDocument()
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
    })

    it('toggles user status', () => {
      render(<UsersTab initialUsers={MOCK_USERS} />)
      const suspendButtons = screen.getAllByLabelText('Suspend user')
      expect(suspendButtons.length).toBeGreaterThan(0)
      fireEvent.click(suspendButtons[0])
      expect(screen.getByLabelText('Reactivate user')).toBeInTheDocument()
    })

    it('shows empty message when no users match', () => {
      render(<UsersTab initialUsers={[]} />)
      expect(screen.getByText('No users found.')).toBeInTheDocument()
    })
  })

  describe('DisputesTab', () => {
    it('renders disputes and filters by status', () => {
      render(<DisputesTab initialDisputes={MOCK_DISPUTES} />)
      expect(screen.getByText(/Dispute #1/)).toBeInTheDocument()

      const resolvedButton = screen.getByRole('button', { name: 'resolved' })
      fireEvent.click(resolvedButton)
      expect(screen.getByText(/Dispute #3/)).toBeInTheDocument()
      expect(screen.queryByText(/Dispute #1/)).not.toBeInTheDocument()
    })

    it('resolves and dismisses a dispute', () => {
      render(<DisputesTab initialDisputes={MOCK_DISPUTES} />)
      const resolveButton = screen.getAllByRole('button', { name: /Resolve/i })[0]
      fireEvent.click(resolveButton)
    })

    it('shows empty message when no disputes exist', () => {
      render(<DisputesTab initialDisputes={[]} />)
      expect(screen.getByText('No disputes found.')).toBeInTheDocument()
    })
  })

  describe('ConfigTab', () => {
    it('validates percentages summing to 100', () => {
      render(<ConfigTab />)
      const saveBtn = screen.getByLabelText('Save configuration')
      expect(saveBtn).not.toBeDisabled()

      const collectorInput = screen.getByLabelText('Collector percentage')
      fireEvent.change(collectorInput, { target: { value: '70' } })

      expect(screen.getByText(/Percentages must sum to 100/i)).toBeInTheDocument()
      expect(saveBtn).toBeDisabled()
    })
  })

  describe('AuditLogTab', () => {
    it('renders audit entries when present', () => {
      addAuditEntry('test_action', 'target_123')
      render(<AuditLogTab />)
      expect(screen.getByText('test_action')).toBeInTheDocument()
      expect(screen.getByText('Target: target_123')).toBeInTheDocument()
    })
  })

  describe('SystemHealthTab', () => {
    it('renders health indicators and uptime summary', () => {
      render(<SystemHealthTab />)
      expect(screen.getByText('RPC Node')).toBeInTheDocument()
      expect(screen.getByText('Contract')).toBeInTheDocument()
      expect(screen.getByText('99.6% uptime')).toBeInTheDocument()
    })
  })
})
