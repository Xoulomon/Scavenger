import type { Notification, NotificationType } from './types'
import { newestFirst, type NotificationTransport } from './transport'

const LS_KEY = (address: string) => `scavngr_notifications_${address}`
const POLL_INTERVAL_MS = 3000

function load(address: string): Notification[] {
  try {
    const raw = localStorage.getItem(LS_KEY(address))
    return raw ? (JSON.parse(raw) as Notification[]) : []
  } catch {
    return []
  }
}

function save(address: string, items: Notification[]): void {
  localStorage.setItem(LS_KEY(address), JSON.stringify(items))
}

/**
 * Persists notifications in localStorage. It is used when Firebase is not
 * configured, and as the offline fallback when Firebase calls fail.
 */
export class LocalStorageNotificationTransport implements NotificationTransport {
  async findRecentUnread(address: string, type: NotificationType, since: number) {
    return load(address).find((n) => n.type === type && !n.read && n.createdAt >= since)
  }

  async insert(address: string, item: Notification) {
    save(address, [item, ...load(address)])
  }

  async incrementCount(address: string, id: string) {
    const items = load(address)
    const hit = items.find((n) => n.id === id)
    if (hit) hit.count += 1
    save(address, items)
  }

  async markRead(address: string, id: string) {
    const items = load(address)
    const hit = items.find((n) => n.id === id)
    if (hit) hit.read = true
    save(address, items)
  }

  async markAllRead(address: string) {
    save(address, load(address).map((n) => ({ ...n, read: true })))
  }

  async remove(address: string, id: string) {
    save(address, load(address).filter((n) => n.id !== id))
  }

  subscribe(address: string, limit: number, onItems: (items: Notification[]) => void) {
    const read = () => {
      try {
        onItems(newestFirst(load(address), limit))
      } catch {
        onItems([])
      }
    }
    read()
    const timer = setInterval(read, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }
}
