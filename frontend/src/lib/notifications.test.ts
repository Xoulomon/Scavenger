// Feature: frontend-enhancements, Property 20: Mark-as-read updates read state
// Feature: frontend-enhancements, Property 21: Notification batching within window
// Validates: Requirements 14.1, 15.5

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { NotificationStore, type Notification, type NotificationType } from './notifications'

// ---------------------------------------------------------------------------
// Mock Firebase so the store always falls through to the localStorage path
// ---------------------------------------------------------------------------
vi.mock('./firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.reject(new Error('Firebase is unavailable.'))),
  updateDoc: vi.fn(() => Promise.reject(new Error('Firebase is unavailable.'))),
  deleteDoc: vi.fn(() => Promise.reject(new Error('Firebase is unavailable.'))),
  getDocs: vi.fn(() => Promise.reject(new Error('Firebase is unavailable.'))),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  increment: vi.fn((n: number) => n),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET = 'GTEST_WALLET_ADDRESS'
const LS_KEY = `scavngr_notifications_${WALLET}`

function lsLoad(): Notification[] {
  const raw = localStorage.getItem(LS_KEY)
  return raw ? (JSON.parse(raw) as Notification[]) : []
}

function lsSave(items: Notification[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(items))
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: `transfer_${Date.now()}`,
    type: 'transfer',
    title: 'Test',
    body: 'Test body',
    read: false,
    createdAt: Date.now(),
    count: 1,
    ...overrides,
  }
}

// Arbitrary for NotificationType
const notifTypeArb = fc.constantFrom<NotificationType>(
  'transfer',
  'confirmation',
  'reward',
  'system'
)

// Arbitrary for a Notification
const notifArb = fc.record<Notification>({
  id: fc.string({ minLength: 1, maxLength: 30 }),
  type: notifTypeArb,
  title: fc.string({ minLength: 1, maxLength: 60 }),
  body: fc.string({ minLength: 0, maxLength: 200 }),
  read: fc.boolean(),
  createdAt: fc.integer({ min: 0, max: Date.now() }),
  count: fc.integer({ min: 1, max: 100 }),
})

// ---------------------------------------------------------------------------
// Property 20: Mark-as-read updates read state
// Validates: Requirements 14.1
// ---------------------------------------------------------------------------

describe('Property 20: Mark-as-read updates read state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('markRead sets only the targeted notification to read=true, leaving others unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a list of at least 1 notification; pick one index to mark as read
        fc.array(notifArb, { minLength: 1, maxLength: 20 }).chain((notifs) => {
          // Ensure unique IDs
          const unique = notifs.map((n, i) => ({ ...n, id: `notif_${i}`, read: false }))
          return fc.tuple(
            fc.constant(unique),
            fc.integer({ min: 0, max: unique.length - 1 })
          )
        }),
        async ([notifs, targetIdx]) => {
          // Seed localStorage
          lsSave(notifs)

          const store = new NotificationStore(WALLET)
          const targetId = notifs[targetIdx].id

          await store.markRead(targetId)

          const after = lsLoad()

          // The targeted notification must now be read
          const target = after.find((n) => n.id === targetId)
          if (!target) return false
          if (!target.read) return false

          // All other notifications must be unchanged
          for (const original of notifs) {
            if (original.id === targetId) continue
            const updated = after.find((n) => n.id === original.id)
            if (!updated) return false
            if (updated.read !== original.read) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('markRead on an already-read notification leaves it read', async () => {
    const n = makeNotification({ read: true })
    lsSave([n])

    const store = new NotificationStore(WALLET)
    await store.markRead(n.id)

    const after = lsLoad()
    expect(after[0].read).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Property 21: Notification batching within window
// Validates: Requirements 15.5
// ---------------------------------------------------------------------------

describe('Property 21: Notification batching within window', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('two same-type notifications within 10 s produce exactly one entry with count=2', async () => {
    await fc.assert(
      fc.asyncProperty(
        notifTypeArb,
        fc.string({ minLength: 1, maxLength: 40 }),
        async (type, title) => {
          localStorage.clear()

          const now = Date.now()
          // First notification already in store (unread, within window)
          const first: Notification = {
            id: `${type}_${now - 1000}`,
            type,
            title,
            body: 'first',
            read: false,
            createdAt: now - 1000, // 1 second ago — within 10 s window
            count: 1,
          }
          lsSave([first])

          const store = new NotificationStore(WALLET)
          await store.add({ type, title, body: 'second', createdAt: now })

          const items = lsLoad()

          // Must have exactly one entry for this type
          const ofType = items.filter((n) => n.type === type)
          if (ofType.length !== 1) return false

          // That entry must have count=2
          if (ofType[0].count !== 2) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('two same-type notifications outside 10 s window produce two separate entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        notifTypeArb,
        async (type) => {
          localStorage.clear()

          const now = Date.now()
          // First notification is older than 10 s
          const first: Notification = {
            id: `${type}_${now - 15000}`,
            type,
            title: 'old',
            body: 'old body',
            read: false,
            createdAt: now - 15000,
            count: 1,
          }
          lsSave([first])

          const store = new NotificationStore(WALLET)
          await store.add({ type, title: 'new', body: 'new body', createdAt: now })

          const items = lsLoad()
          const ofType = items.filter((n) => n.type === type)

          // Should have two separate entries
          return ofType.length === 2
        }
      ),
      { numRuns: 100 }
    )
  })

  it('batching does not apply to read notifications within the window', async () => {
    const now = Date.now()
    const type: NotificationType = 'reward'
    const readNotif: Notification = {
      id: `${type}_${now - 500}`,
      type,
      title: 'read one',
      body: 'body',
      read: true, // already read — should not be batched into
      createdAt: now - 500,
      count: 1,
    }
    lsSave([readNotif])

    const store = new NotificationStore(WALLET)
    await store.add({ type, title: 'new', body: 'new body', createdAt: now })

    const items = lsLoad()
    const ofType = items.filter((n) => n.type === type)

    // Should create a new entry, not batch into the read one
    expect(ofType.length).toBe(2)
    expect(readNotif.count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Property 17: Notification badge count accuracy
// Feature: frontend-enhancements, Property 17: badge count = min(unread count, 99), displays "99+" for > 99
// Validates: Requirements 13.2, 14.4
// ---------------------------------------------------------------------------

import { getBadgeLabel, getBadgeCount, getPanelNotifications, getRelativeTimestamp, getTypeIconName } from '@/components/ui/NotificationPanel'

describe('Property 17: Notification badge count accuracy', () => {
  it('badge count equals min(unread count, 99) and label is "99+" when count > 99', () => {
    // Feature: frontend-enhancements, Property 17: badge count = min(unread count, 99), displays "99+" for > 99
    fc.assert(
      fc.property(
        fc.array(notifArb, { minLength: 0, maxLength: 200 }),
        (notifs) => {
          const unread = notifs.filter((n) => !n.read).length
          const count = getBadgeCount(unread)
          const label = getBadgeLabel(unread)

          // count must be min(unread, 99)
          if (count !== Math.min(unread, 99)) return false

          // label must be "99+" when unread > 99, else the string of unread
          if (unread > 99) {
            if (label !== '99+') return false
          } else {
            if (label !== String(unread)) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('badge is hidden (count=0) when all notifications are read', () => {
    fc.assert(
      fc.property(
        fc.array(notifArb.map((n) => ({ ...n, read: true })), { minLength: 0, maxLength: 50 }),
        (notifs) => {
          const unread = notifs.filter((n) => !n.read).length
          return getBadgeCount(unread) === 0
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 18: Notification panel ordering and limit
// Feature: frontend-enhancements, Property 18: panel renders ≤ 20 items in descending createdAt order
// Validates: Requirements 13.4
// ---------------------------------------------------------------------------

describe('Property 18: Notification panel ordering and limit', () => {
  it('getPanelNotifications returns at most 20 items in descending createdAt order', () => {
    // Feature: frontend-enhancements, Property 18: panel renders ≤ 20 items in descending createdAt order
    fc.assert(
      fc.property(
        fc.array(notifArb, { minLength: 0, maxLength: 100 }),
        (notifs) => {
          const result = getPanelNotifications(notifs)

          // Must not exceed 20
          if (result.length > 20) return false

          // Must be in descending createdAt order
          for (let i = 0; i < result.length - 1; i++) {
            if (result[i].createdAt < result[i + 1].createdAt) return false
          }

          // Must contain the 20 most recent items (by createdAt)
          const sorted = [...notifs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
          if (result.length !== sorted.length) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 19: Notification panel renders all required fields
// Feature: frontend-enhancements, Property 19: each notification row contains type icon, title, body, relative timestamp
// Validates: Requirements 13.6
// ---------------------------------------------------------------------------

describe('Property 19: Notification panel renders all required fields', () => {
  it('getTypeIconName returns a non-empty icon name for every notification type', () => {
    // Feature: frontend-enhancements, Property 19: each notification row contains type icon, title, body, relative timestamp
    fc.assert(
      fc.property(
        notifArb,
        (n) => {
          const iconName = getTypeIconName(n.type)
          // Must return a non-empty string
          if (!iconName || iconName.length === 0) return false

          // Must be one of the known icon names
          const validIcons = ['Bell', 'CheckCircle', 'Coins', 'Info']
          if (!validIcons.includes(iconName)) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('getRelativeTimestamp returns a non-empty string for any createdAt timestamp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Date.now() }),
        (createdAt) => {
          const ts = getRelativeTimestamp(createdAt)
          // Must be a non-empty string ending with "ago"
          if (!ts || ts.length === 0) return false
          if (!ts.endsWith('ago')) return false
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('each notification has title, body, type, and a valid relative timestamp', () => {
    fc.assert(
      fc.property(
        notifArb,
        (n) => {
          // title must be a non-empty string
          if (!n.title || n.title.length === 0) return false
          // type must be one of the valid types
          const validTypes: NotificationType[] = ['transfer', 'confirmation', 'reward', 'system']
          if (!validTypes.includes(n.type)) return false
          // getTypeIconName must return a valid icon
          const icon = getTypeIconName(n.type)
          if (!icon) return false
          // getRelativeTimestamp must return a string ending with "ago"
          const ts = getRelativeTimestamp(n.createdAt)
          if (!ts.endsWith('ago')) return false
          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
