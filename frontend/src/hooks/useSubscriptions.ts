import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SubscriptionStorage,
  Subscription,
  SubscriptionHistoryEntry,
  SubscriptionFrequency
} from '@/lib/subscriptionStorage'
import { NotificationStore } from '@/lib/notifications'

export interface CreateSubscriptionInput {
  recyclerAddress: string
  recyclerName: string
  frequency: SubscriptionFrequency
  wasteTypes: string[]
  startDate: number
}

export function useSubscriptions(collectorAddress: string | null | undefined) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storageRef = useRef<SubscriptionStorage | null>(null)
  const notifRef = useRef<NotificationStore | null>(null)

  useEffect(() => {
    if (!collectorAddress) {
      setSubscriptions([])
      setHistory([])
      storageRef.current = null
      notifRef.current = null
      return
    }
    storageRef.current = new SubscriptionStorage(collectorAddress)
    notifRef.current = new NotificationStore(collectorAddress)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorAddress])

  // Check for upcoming pickups and fire notifications
  useEffect(() => {
    if (!notifRef.current) return
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    subscriptions
      .filter((s) => s.status === 'active' && s.nextPickup - now <= oneDayMs && s.nextPickup > now)
      .forEach((s) => {
        notifRef.current!.add({
          type: 'system',
          title: 'Pickup Reminder',
          body: `Pickup from ${s.recyclerName} is scheduled tomorrow.`,
          createdAt: now
        })
      })
  }, [subscriptions])

  const refresh = useCallback(() => {
    if (!storageRef.current) return
    setIsLoading(true)
    try {
      setSubscriptions(storageRef.current.getAll())
      setHistory(storageRef.current.getHistory())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const create = useCallback(
    (input: CreateSubscriptionInput): Subscription | null => {
      if (!storageRef.current || !collectorAddress) return null
      try {
        const sub = storageRef.current.create({ ...input, collectorAddress, status: 'active' })
        notifRef.current?.add({
          type: 'system',
          title: 'Subscription Created',
          body: `Weekly pickup from ${sub.recyclerName} scheduled.`,
          createdAt: Date.now()
        })
        refresh()
        return sub
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create subscription')
        return null
      }
    },
    [collectorAddress, refresh]
  )

  const pause = useCallback(
    (id: string): boolean => {
      if (!storageRef.current) return false
      const result = storageRef.current.pause(id)
      if (result) refresh()
      return !!result
    },
    [refresh]
  )

  const resume = useCallback(
    (id: string): boolean => {
      if (!storageRef.current) return false
      const result = storageRef.current.resume(id)
      if (result) refresh()
      return !!result
    },
    [refresh]
  )

  const cancel = useCallback(
    (id: string): boolean => {
      if (!storageRef.current) return false
      const result = storageRef.current.cancel(id)
      if (result) refresh()
      return !!result
    },
    [refresh]
  )

  const recordPickup = useCallback(
    (id: string): boolean => {
      if (!storageRef.current) return false
      const result = storageRef.current.recordPickup(id)
      if (result) {
        notifRef.current?.add({
          type: 'system',
          title: 'Pickup Completed',
          body: `Pickup recorded. Next pickup scheduled.`,
          createdAt: Date.now()
        })
        refresh()
      }
      return !!result
    },
    [refresh]
  )

  const active = subscriptions.filter((s) => s.status === 'active')
  const paused = subscriptions.filter((s) => s.status === 'paused')
  const cancelled = subscriptions.filter((s) => s.status === 'cancelled')

  return {
    subscriptions,
    active,
    paused,
    cancelled,
    history,
    isLoading,
    error,
    create,
    pause,
    resume,
    cancel,
    recordPickup,
    refresh
  }
}
