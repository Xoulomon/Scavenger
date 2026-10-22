import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Notification } from './types'
import type { NotificationTransport } from './transport'
import { InMemoryNotificationTransport } from './inMemoryTransport'
import { LocalStorageNotificationTransport } from './localStorageTransport'

const ADDR = 'GCONTRACT'

function item(overrides: Partial<Notification> & Pick<Notification, 'id' | 'createdAt'>): Notification {
  return { type: 'transfer', title: 't', body: 'b', read: false, count: 1, ...overrides }
}

// The same behavioural contract runs against every transport implementation.
const implementations: Array<[string, () => NotificationTransport]> = [
  ['in-memory', () => new InMemoryNotificationTransport()],
  ['localStorage', () => new LocalStorageNotificationTransport()],
]

describe.each(implementations)('NotificationTransport contract: %s', (_name, make) => {
  let t: NotificationTransport

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    t = make()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('finds the newest unread item of the requested type inside the window', async () => {
    await t.insert(ADDR, item({ id: 'transfer_1', createdAt: 1_000 }))
    await t.insert(ADDR, item({ id: 'transfer_2', createdAt: 2_000 }))
    await t.insert(ADDR, item({ id: 'reward_1', type: 'reward', createdAt: 2_500 }))

    expect((await t.findRecentUnread(ADDR, 'transfer', 1_500))?.id).toBe('transfer_2')
    expect(await t.findRecentUnread(ADDR, 'transfer', 3_000)).toBeUndefined()
  })

  it('ignores read items when looking for a batch target', async () => {
    await t.insert(ADDR, item({ id: 'transfer_1', createdAt: 1_000 }))
    await t.markRead(ADDR, 'transfer_1')

    expect(await t.findRecentUnread(ADDR, 'transfer', 0)).toBeUndefined()
  })

  it('increments the count of an existing item', async () => {
    await t.insert(ADDR, item({ id: 'transfer_1', createdAt: 1_000 }))
    await t.incrementCount(ADDR, 'transfer_1')

    expect((await t.findRecentUnread(ADDR, 'transfer', 0))?.count).toBe(2)
  })

  it('marks one item read and all items read', async () => {
    await t.insert(ADDR, item({ id: 'a', createdAt: 1 }))
    await t.insert(ADDR, item({ id: 'b', createdAt: 2 }))

    await t.markRead(ADDR, 'a')
    const afterOne = await collect(t)
    expect(afterOne.find((n) => n.id === 'a')?.read).toBe(true)
    expect(afterOne.find((n) => n.id === 'b')?.read).toBe(false)

    await t.markAllRead(ADDR)
    expect((await collect(t)).every((n) => n.read)).toBe(true)
  })

  it('removes an item by id', async () => {
    await t.insert(ADDR, item({ id: 'a', createdAt: 1 }))
    await t.insert(ADDR, item({ id: 'b', createdAt: 2 }))
    await t.remove(ADDR, 'a')

    expect((await collect(t)).map((n) => n.id)).toEqual(['b'])
  })

  it('keeps addresses separate', async () => {
    await t.insert(ADDR, item({ id: 'a', createdAt: 1 }))

    expect(await t.findRecentUnread('GOTHER', 'transfer', 0)).toBeUndefined()
  })

  it('subscribe emits the newest items first, capped at the limit', () => {
    const emissions: Notification[][] = []
    const stop = t.subscribe(ADDR, 2, (items) => emissions.push(items))

    return Promise.all([
      t.insert(ADDR, item({ id: 'old', createdAt: 1 })),
      t.insert(ADDR, item({ id: 'mid', createdAt: 2 })),
      t.insert(ADDR, item({ id: 'new', createdAt: 3 })),
    ]).then(() => {
      vi.advanceTimersByTime(3_000)
      stop()
      const latest = emissions[emissions.length - 1]
      expect(latest.map((n) => n.id)).toEqual(['new', 'mid'])
    })
  })

  it('unsubscribe stops further emissions', async () => {
    const onItems = vi.fn()
    const stop = t.subscribe(ADDR, 10, onItems)
    stop()
    const callsBefore = onItems.mock.calls.length

    await t.insert(ADDR, item({ id: 'late', createdAt: 5 }))
    vi.advanceTimersByTime(10_000)

    expect(onItems.mock.calls.length).toBe(callsBefore)
  })
})

async function collect(t: NotificationTransport): Promise<Notification[]> {
  let latest: Notification[] = []
  const stop = t.subscribe(ADDR, 100, (items) => {
    latest = items
  })
  stop()
  return latest
}
