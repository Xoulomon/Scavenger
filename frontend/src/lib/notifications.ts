import type { Notification, NewNotification, NotificationPreferences } from './notifications/types'
import type { NotificationTransport } from './notifications/transport'
import { LocalStorageNotificationTransport } from './notifications/localStorageTransport'

export type { Notification, NotificationType, NotificationPreferences, NewNotification } from './notifications/types'
export type { NotificationTransport } from './notifications/transport'
export { InMemoryNotificationTransport } from './notifications/inMemoryTransport'
export { LocalStorageNotificationTransport } from './notifications/localStorageTransport'

export const DEFAULT_PREFS: NotificationPreferences = {
  transfer: true,
  confirmation: true,
  reward: true,
  system: true,
}

const PREFS_KEY = 'scavngr_notif_prefs'
const BATCH_WINDOW_MS = 10_000

function loadPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? (JSON.parse(raw) as NotificationPreferences) : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function savePrefs(prefs: NotificationPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

/** Remote transport is used only when Firebase is configured; otherwise localStorage is the store. */
function isRemoteConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID)
}

async function loadDefaultRemote(): Promise<NotificationTransport> {
  if (!isRemoteConfigured()) return new LocalStorageNotificationTransport()
  const { createFirebaseTransport } = await import('./notifications/firebaseTransport')
  return createFirebaseTransport()
}

export interface NotificationStoreOptions {
  /** Primary transport. Defaults to Firebase when configured, otherwise localStorage. */
  remote?: NotificationTransport
}

export class NotificationStore {
  private walletAddress: string
  private remote: NotificationTransport | null
  private remotePromise: Promise<NotificationTransport> | null = null
  private readonly local = new LocalStorageNotificationTransport()

  constructor(walletAddress: string, options: NotificationStoreOptions = {}) {
    this.walletAddress = walletAddress
    this.remote = options.remote ?? null
  }

  private getRemote(): Promise<NotificationTransport> {
    if (this.remote) return Promise.resolve(this.remote)
    this.remotePromise ??= loadDefaultRemote().then((t) => {
      this.remote = t
      return t
    })
    return this.remotePromise
  }

  /** Runs `op` on the primary transport and retries it on localStorage if the primary fails. */
  private async withFallback(op: (t: NotificationTransport) => Promise<void>): Promise<void> {
    try {
      await op(await this.getRemote())
    } catch {
      await op(this.local)
    }
  }

  async add(notification: NewNotification): Promise<void> {
    if (!loadPrefs()[notification.type]) return

    const now = Date.now()
    const since = now - BATCH_WINDOW_MS
    const address = this.walletAddress

    await this.withFallback(async (t) => {
      const recent = await t.findRecentUnread(address, notification.type, since)
      if (recent) {
        await t.incrementCount(address, recent.id)
        return
      }
      await t.insert(address, { ...notification, id: `${notification.type}_${now}`, read: false, count: 1 })
    })
  }

  async markRead(id: string): Promise<void> {
    const address = this.walletAddress
    await this.withFallback((t) => t.markRead(address, id))
  }

  async markAllRead(): Promise<void> {
    const address = this.walletAddress
    await this.withFallback((t) => t.markAllRead(address))
  }

  async delete(id: string): Promise<void> {
    const address = this.walletAddress
    await this.withFallback((t) => t.remove(address, id))
  }

  /**
   * Streams the newest `limit` notifications. If the primary transport reports an error,
   * the stream switches to localStorage. Returns an unsubscribe function.
   */
  subscribe(limit: number, onItems: (items: Notification[]) => void): () => void {
    const address = this.walletAddress
    let active = true
    let fellBack = false
    let unsubscribe: (() => void) | null = null

    const switchToLocal = () => {
      if (fellBack || !active) return
      fellBack = true
      unsubscribe?.()
      unsubscribe = this.local.subscribe(address, limit, onItems)
    }

    this.getRemote()
      .then((remote) => {
        if (!active || fellBack) return
        const stop = remote.subscribe(address, limit, onItems, switchToLocal)
        if (fellBack) stop()
        else unsubscribe = stop
      })
      .catch(switchToLocal)

    return () => {
      active = false
      unsubscribe?.()
    }
  }

  static loadPrefs = loadPrefs
  static savePrefs = savePrefs
}
