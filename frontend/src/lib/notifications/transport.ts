import type { Notification, NotificationType } from './types'

/**
 * Storage boundary for notifications. Every implementation keys items by wallet
 * address. Pages and hooks talk to NotificationStore, never to a transport
 * directly, so the backend can be swapped without touching UI code.
 */
export interface NotificationTransport {
  /** Newest unread item of `type` created at or after `since`, if any. */
  findRecentUnread(address: string, type: NotificationType, since: number): Promise<Notification | undefined>
  insert(address: string, item: Notification): Promise<void>
  incrementCount(address: string, id: string): Promise<void>
  markRead(address: string, id: string): Promise<void>
  markAllRead(address: string): Promise<void>
  remove(address: string, id: string): Promise<void>
  /**
   * Emits the newest `limit` items, newest first, now and on every change.
   * `onError` is called when the backend stops delivering updates.
   * Returns an unsubscribe function.
   */
  subscribe(
    address: string,
    limit: number,
    onItems: (items: Notification[]) => void,
    onError?: (error: unknown) => void,
  ): () => void
}

export function newestFirst(items: Notification[], limit: number): Notification[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}
