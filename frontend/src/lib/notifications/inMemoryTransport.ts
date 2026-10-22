import type { Notification, NotificationType } from './types'
import { newestFirst, type NotificationTransport } from './transport'

type Listener = (items: Notification[]) => void

/** Process-local transport for tests and for previews where nothing should persist. */
export class InMemoryNotificationTransport implements NotificationTransport {
  private items = new Map<string, Notification[]>()
  private listeners = new Map<string, Set<{ limit: number; onItems: Listener }>>()

  private list(address: string): Notification[] {
    return this.items.get(address) ?? []
  }

  private set(address: string, items: Notification[]): void {
    this.items.set(address, items)
    for (const l of this.listeners.get(address) ?? []) {
      l.onItems(newestFirst(items, l.limit))
    }
  }

  async findRecentUnread(address: string, type: NotificationType, since: number) {
    return this.list(address).find((n) => n.type === type && !n.read && n.createdAt >= since)
  }

  async insert(address: string, item: Notification) {
    this.set(address, [item, ...this.list(address)])
  }

  async incrementCount(address: string, id: string) {
    this.set(address, this.list(address).map((n) => (n.id === id ? { ...n, count: n.count + 1 } : n)))
  }

  async markRead(address: string, id: string) {
    this.set(address, this.list(address).map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async markAllRead(address: string) {
    this.set(address, this.list(address).map((n) => ({ ...n, read: true })))
  }

  async remove(address: string, id: string) {
    this.set(address, this.list(address).filter((n) => n.id !== id))
  }

  subscribe(address: string, limit: number, onItems: Listener) {
    const entry = { limit, onItems }
    const set = this.listeners.get(address) ?? new Set()
    set.add(entry)
    this.listeners.set(address, set)
    onItems(newestFirst(this.list(address), limit))
    return () => {
      set.delete(entry)
    }
  }
}
