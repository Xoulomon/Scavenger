import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  add: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: vi.fn(() => 'docRef'),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  query: vi.fn((...a: unknown[]) => a),
  where: vi.fn((...a: unknown[]) => a),
  orderBy: vi.fn((...a: unknown[]) => a),
  increment: vi.fn((n: number) => n),
}))

vi.mock('@/lib/notifications', () => {
  class NotificationStore {
    add = mocks.add
  }
  return { NotificationStore }
})

import { useSubscriptions } from '@/hooks/useSubscriptions'
import { nextPickupDate } from '@/lib/subscriptionStorage'

const ADDR = 'GCOLLECTOR123'

function makeInput(overrides = {}) {
  return {
    recyclerAddress: 'GRECYCLER456',
    recyclerName: 'Green Recyclers',
    frequency: 'weekly' as const,
    wasteTypes: ['Paper'],
    startDate: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useSubscriptions', () => {
  it('initialises with empty state when no address', () => {
    const { result } = renderHook(() => useSubscriptions(null))
    expect(result.current.subscriptions).toEqual([])
    expect(result.current.history).toEqual([])
  })

  it('creates a subscription and returns it', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let sub: ReturnType<typeof result.current.create>
    act(() => {
      sub = result.current.create(makeInput())
    })
    expect(sub).not.toBeNull()
    expect(result.current.subscriptions).toHaveLength(1)
    expect(result.current.active).toHaveLength(1)
  })

  it('new subscription has status active', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    act(() => { result.current.create(makeInput()) })
    expect(result.current.subscriptions[0].status).toBe('active')
  })

  it('pauses an active subscription', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let id: string
    act(() => {
      const sub = result.current.create(makeInput())!
      id = sub.id
    })
    act(() => { result.current.pause(id) })
    expect(result.current.paused).toHaveLength(1)
    expect(result.current.active).toHaveLength(0)
  })

  it('resumes a paused subscription', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let id: string
    act(() => {
      const sub = result.current.create(makeInput())!
      id = sub.id
    })
    act(() => { result.current.pause(id) })
    act(() => { result.current.resume(id) })
    expect(result.current.active).toHaveLength(1)
    expect(result.current.paused).toHaveLength(0)
  })

  it('cancels a subscription', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let id: string
    act(() => {
      const sub = result.current.create(makeInput())!
      id = sub.id
    })
    act(() => { result.current.cancel(id) })
    expect(result.current.cancelled).toHaveLength(1)
    expect(result.current.active).toHaveLength(0)
  })

  it('recordPickup advances nextPickup date', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let id: string
    let originalNext: number
    act(() => {
      const sub = result.current.create(makeInput())!
      id = sub.id
      originalNext = sub.nextPickup
    })
    act(() => { result.current.recordPickup(id) })
    const updated = result.current.subscriptions.find((s) => s.id === id)!
    expect(updated.nextPickup).toBeGreaterThan(originalNext)
  })

  it('history records created and paused events', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let id: string
    act(() => {
      const sub = result.current.create(makeInput())!
      id = sub.id
    })
    act(() => { result.current.pause(id) })
    const actions = result.current.history.map((h) => h.action)
    expect(actions).toContain('created')
    expect(actions).toContain('paused')
  })

  it('returns false and does nothing for unknown id', () => {
    const { result } = renderHook(() => useSubscriptions(ADDR))
    let ok: boolean
    act(() => { ok = result.current.pause('nonexistent') })
    expect(ok!).toBe(false)
    expect(result.current.subscriptions).toHaveLength(0)
  })

  it('nextPickupDate adds 7 days for weekly', () => {
    const base = new Date('2025-01-01').getTime()
    const next = nextPickupDate(base, 'weekly')
    expect(new Date(next).getDate()).toBe(8)
  })

  it('nextPickupDate adds 14 days for bi-weekly', () => {
    const base = new Date('2025-01-01').getTime()
    const next = nextPickupDate(base, 'bi-weekly')
    expect(new Date(next).getDate()).toBe(15)
  })

  it('nextPickupDate adds 1 month for monthly', () => {
    const base = new Date('2025-01-01').getTime()
    const next = nextPickupDate(base, 'monthly')
    expect(new Date(next).getMonth()).toBe(1) // February
  })

  it('create returns null when no address', () => {
    const { result } = renderHook(() => useSubscriptions(null))
    let sub: ReturnType<typeof result.current.create>
    act(() => { sub = result.current.create(makeInput()) })
    expect(sub).toBeNull()
  })
})
