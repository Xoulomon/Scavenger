export type SubscriptionFrequency = 'weekly' | 'bi-weekly' | 'monthly'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export interface Subscription {
  id: string
  collectorAddress: string
  recyclerAddress: string
  recyclerName: string
  frequency: SubscriptionFrequency
  status: SubscriptionStatus
  wasteTypes: string[]
  startDate: number
  nextPickup: number
  pausedAt?: number
  createdAt: number
}

export interface SubscriptionHistoryEntry {
  id: string
  subscriptionId: string
  action: 'created' | 'paused' | 'resumed' | 'cancelled' | 'pickup_completed'
  timestamp: number
  note?: string
}

const LS_KEY = (address: string) => `scavngr_subscriptions_${address}`
const HIST_KEY = (address: string) => `scavngr_sub_history_${address}`

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export function nextPickupDate(from: number, frequency: SubscriptionFrequency): number {
  const d = new Date(from)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'bi-weekly') d.setDate(d.getDate() + 14)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

export class SubscriptionStorage {
  private address: string

  constructor(address: string) {
    this.address = address
  }

  getAll(): Subscription[] {
    return load<Subscription>(LS_KEY(this.address))
  }

  getById(id: string): Subscription | undefined {
    return this.getAll().find((s) => s.id === id)
  }

  create(data: Omit<Subscription, 'id' | 'createdAt' | 'nextPickup'>): Subscription {
    const now = Date.now()
    const sub: Subscription = {
      ...data,
      id: `sub_${now}`,
      createdAt: now,
      nextPickup: nextPickupDate(data.startDate, data.frequency)
    }
    const all = this.getAll()
    save(LS_KEY(this.address), [...all, sub])
    this.addHistory({ subscriptionId: sub.id, action: 'created', timestamp: now })
    return sub
  }

  update(id: string, patch: Partial<Subscription>): Subscription | null {
    const all = this.getAll()
    const idx = all.findIndex((s) => s.id === id)
    if (idx === -1) return null
    all[idx] = { ...all[idx], ...patch }
    save(LS_KEY(this.address), all)
    return all[idx]
  }

  pause(id: string): Subscription | null {
    const now = Date.now()
    const sub = this.update(id, { status: 'paused', pausedAt: now })
    if (sub) this.addHistory({ subscriptionId: id, action: 'paused', timestamp: now })
    return sub
  }

  resume(id: string): Subscription | null {
    const sub = this.getById(id)
    if (!sub) return null
    const now = Date.now()
    const updated = this.update(id, {
      status: 'active',
      pausedAt: undefined,
      nextPickup: nextPickupDate(now, sub.frequency)
    })
    if (updated) this.addHistory({ subscriptionId: id, action: 'resumed', timestamp: now })
    return updated
  }

  cancel(id: string): Subscription | null {
    const now = Date.now()
    const sub = this.update(id, { status: 'cancelled' })
    if (sub) this.addHistory({ subscriptionId: id, action: 'cancelled', timestamp: now })
    return sub
  }

  recordPickup(id: string): Subscription | null {
    const sub = this.getById(id)
    if (!sub) return null
    const now = Date.now()
    const updated = this.update(id, { nextPickup: nextPickupDate(now, sub.frequency) })
    if (updated) this.addHistory({ subscriptionId: id, action: 'pickup_completed', timestamp: now })
    return updated
  }

  getHistory(): SubscriptionHistoryEntry[] {
    return load<SubscriptionHistoryEntry>(HIST_KEY(this.address))
  }

  private addHistory(entry: Omit<SubscriptionHistoryEntry, 'id'>): void {
    const all = this.getHistory()
    save(HIST_KEY(this.address), [
      { ...entry, id: `hist_${Date.now()}_${Math.random().toString(36).slice(2)}` },
      ...all
    ])
  }
}
