import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NotificationStore, type Notification } from '@/lib/notifications'
import { cacheKeys } from '@/lib/queryClient'
import { queryCachePolicy } from '@/lib/queryCachePolicy'

const MAX_NOTIFICATIONS = 20
const UNREAD_CAP = 99

export function useNotifications(walletAddress: string | null | undefined) {
  const queryClient = useQueryClient()
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

  // Keep the notifications query cache in sync with the store subscription so
  // other consumers of cacheKeys.notifications(walletAddress) stay fresh.
  useQuery({
    queryKey: cacheKeys.notifications(walletAddress ?? ''),
    queryFn: () => notifications,
    enabled: Boolean(walletAddress),
    ...queryCachePolicy.notifications,
    initialData: notifications
  })

  const invalidateNotifications = async (): Promise<void> => {
    if (!walletAddress) return
    await queryClient.invalidateQueries({
      queryKey: cacheKeys.notifications(walletAddress)
    })
  }

  const unreadCount = Math.min(notifications.filter((n) => !n.read).length, UNREAD_CAP)

  const markRead = async (id: string): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.markRead(id)
    await invalidateNotifications()
  }

  const markAllRead = async (): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.markAllRead()
    await invalidateNotifications()
  }

  const deleteNotification = async (id: string): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.delete(id)
    await invalidateNotifications()
  }

  const addNotification = async (n: Omit<Notification, 'id' | 'read' | 'count'>): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.add(n)
    await invalidateNotifications()
  }

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    addNotification
  }
}
