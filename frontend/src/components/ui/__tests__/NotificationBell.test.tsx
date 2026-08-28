import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { NotificationBell } from '../NotificationBell'

expect.extend(toHaveNoViolations)

// Mock wallet context
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GABC123' }),
}))

// Mock notifications hook
const mockMarkRead = vi.fn()
const mockMarkAllRead = vi.fn()
const mockDeleteNotification = vi.fn()
let mockNotificationState = {
  notifications: [] as unknown[],
  unreadCount: 0,
  markRead: mockMarkRead,
  markAllRead: mockMarkAllRead,
  deleteNotification: mockDeleteNotification,
}

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => mockNotificationState,
}))

// Mock NotificationPanel to control rendering
vi.mock('@/components/ui/NotificationPanel', () => ({
  NotificationPanel: ({
    onClose,
  }: {
    onClose: () => void
    onMarkRead: (id: string) => void
    onMarkAllRead: () => void
    onDelete: (id: string) => void
    notifications: unknown[]
  }) => (
    <div data-testid="notification-panel" role="region" aria-label="Notifications">
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}))

describe('NotificationBell', () => {
  beforeEach(() => {
    mockMarkRead.mockClear()
    mockMarkAllRead.mockClear()
    mockDeleteNotification.mockClear()
    mockNotificationState = {
      notifications: [],
      unreadCount: 0,
      markRead: mockMarkRead,
      markAllRead: mockMarkAllRead,
      deleteNotification: mockDeleteNotification,
    }
  })

  describe('Rendering', () => {
    it('renders the bell button', () => {
      render(<NotificationBell />)
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    })

    it('does not show badge when unreadCount is 0', () => {
      render(<NotificationBell />)
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('shows badge with count when there are unread notifications', () => {
      mockNotificationState.unreadCount = 5
      render(<NotificationBell />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows "99+" when unreadCount exceeds 99', () => {
      mockNotificationState.unreadCount = 150
      render(<NotificationBell />)
      expect(screen.getByText('99+')).toBeInTheDocument()
    })

    it('includes unread count in aria-label when there are unread', () => {
      mockNotificationState.unreadCount = 3
      render(<NotificationBell />)
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Notifications, 3 unread'
      )
    })

    it('uses plain "Notifications" aria-label when 0 unread', () => {
      render(<NotificationBell />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Notifications')
    })

    it('applies custom className', () => {
      const { container } = render(<NotificationBell className="custom-bell" />)
      expect(container.firstChild).toHaveClass('custom-bell')
    })
  })

  describe('Interactions', () => {
    it('opens notification panel when bell is clicked', async () => {
      render(<NotificationBell />)
      await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => {
        expect(screen.getByTestId('notification-panel')).toBeInTheDocument()
      })
    })

    it('closes notification panel when clicked again', async () => {
      render(<NotificationBell />)
      const btn = screen.getByRole('button', { name: /notifications/i })
      await userEvent.click(btn)
      await waitFor(() => screen.getByTestId('notification-panel'))
      await userEvent.click(btn)
      await waitFor(() => {
        expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
      })
    })

    it('closes panel when panel onClose is called', async () => {
      render(<NotificationBell />)
      await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
      await waitFor(() => screen.getByTestId('notification-panel'))
      await userEvent.click(screen.getByRole('button', { name: /close panel/i }))
      await waitFor(() => {
        expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('bell button has aria-label', () => {
      render(<NotificationBell />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label')
    })

    it('passes axe audit — no unread', async () => {
      const { container } = render(<NotificationBell />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — with unread count', async () => {
      mockNotificationState.unreadCount = 7
      const { container } = render(<NotificationBell />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
