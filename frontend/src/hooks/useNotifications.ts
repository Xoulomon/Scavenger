import { useState, useEffect, useRef } from 'react'
import { NotificationStore, type Notification } from '@/lib/notifications'

const MAX_NOTIFICATIONS = 20
const UNREAD_CAP = 99

export function useNotifications(walletAddress: string | null | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const storeRef = useRef<NotificationStore | null>(null)

  // Create/update store when walletAddress changes
  useEffect(() => {
    if (!walletAddress) {
      setNotifications([])
      storeRef.current = null
      return
    }

    const store = new NotificationStore(walletAddress)
    storeRef.current = store
    return store.subscribe(MAX_NOTIFICATIONS, setNotifications)
  }, [walletAddress])

  const unreadCount = Math.min(
    notifications.filter((n) => !n.read).length,
    UNREAD_CAP
  )

  const markRead = async (id: string): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.markRead(id)
  }

  const markAllRead = async (): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.markAllRead()
  }

  const deleteNotification = async (id: string): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.delete(id)
  }

  const addNotification = async (
    n: Omit<Notification, 'id' | 'read' | 'count'>
  ): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.add(n)
  }

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    addNotification,
  }
}
