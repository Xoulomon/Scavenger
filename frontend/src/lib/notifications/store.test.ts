import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NotificationStore, InMemoryNotificationTransport, type NotificationTransport, type Notification } from '.'

const WALLET = 'GSTORE'
const LS_KEY = `scavngr_notifications_${WALLET}`

function brokenTransport(): NotificationTransport {
  const fail = () => Promise.reject(new Error('remote down'))
  return {
    findRecentUnread: fail,
    insert: fail,
    incrementCount: fail,
    markRead: fail,
    markAllRead: fail,
    remove: fail,
    subscribe: (_a, _l, _o, onError) => {
      onError?.(new Error('remote down'))
      return () => {}
    },
  }
}

// subscribe() resolves its transport asynchronously, so let pending promises settle first.
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const lsItems = (): Notification[] => JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')

describe('NotificationStore transport boundary', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes through the injected transport and leaves localStorage alone', async () => {
    const remote = new InMemoryNotificationTransport()
    const store = new NotificationStore(WALLET, { remote })

    await store.add({ type: 'reward', title: 'Reward', body: 'You earned 5', createdAt: Date.now() })

    const seen: Notification[][] = []
    const stop = store.subscribe(10, (items) => seen.push(items))
    await flush()
    stop()
    expect(seen[0]).toHaveLength(1)
    expect(seen[0][0].title).toBe('Reward')
    expect(localStorage.getItem(LS_KEY)).toBeNull()
  })

  it('falls back to localStorage when the remote write fails', async () => {
    const store = new NotificationStore(WALLET, { remote: brokenTransport() })

    await store.add({ type: 'system', title: 'Hello', body: 'b', createdAt: Date.now() })

    expect(lsItems()).toHaveLength(1)
    expect(lsItems()[0]).toMatchObject({ title: 'Hello', count: 1, read: false })
  })

  it('switches a failing subscription to localStorage', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify([{ id: 'x', type: 'system', title: 'Cached', body: '', read: false, createdAt: Date.now(), count: 1 }]))
    const seen: Notification[][] = []
    const stop = new NotificationStore(WALLET, { remote: brokenTransport() }).subscribe(5, (items) => seen.push(items))
    await flush()

    expect(seen.at(-1)?.[0]?.title).toBe('Cached')
    stop()
  })

  it('does not write preferences-disabled types', async () => {
    localStorage.setItem('scavngr_notif_prefs', JSON.stringify({ transfer: false, confirmation: true, reward: true, system: true }))
    const remote = new InMemoryNotificationTransport()
    const store = new NotificationStore(WALLET, { remote })

    await store.add({ type: 'transfer', title: 'Muted', body: '', createdAt: Date.now() })

    const seen: Notification[][] = []
    const stop = store.subscribe(5, (items) => seen.push(items))
    await flush()
    stop()
    expect(seen[0]).toEqual([])
  })
})
