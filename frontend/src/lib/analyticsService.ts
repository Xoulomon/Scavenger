/**
 * User behavior analytics service (Issue #780)
 *
 * Tracks user interactions, page views, and funnel events.
 * Stores events in localStorage for persistence and exposes
 * query helpers for dashboard/cohort analysis.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EventCategory =
  'navigation' | 'waste' | 'rewards' | 'wallet' | 'participant' | 'incentive' | 'search' | 'ui'

export interface AnalyticsEvent {
  id: string
  category: EventCategory
  action: string
  label?: string
  value?: number
  userId?: string
  sessionId: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface SessionInfo {
  sessionId: string
  startedAt: number
  pageViews: number
  events: number
}

export interface FunnelStep {
  name: string
  count: number
  dropOff: number
  conversionRate: number
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const EVENTS_KEY = 'scavngr_analytics_events'
const SESSION_KEY = 'scavngr_analytics_session'
const MAX_EVENTS = 500

// ── Session management ────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getSession(): SessionInfo {
  const stored = sessionStorage.getItem(SESSION_KEY)
  if (stored) return JSON.parse(stored) as SessionInfo
  const session: SessionInfo = {
    sessionId: generateId(),
    startedAt: Date.now(),
    pageViews: 0,
    events: 0
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

function saveSession(session: SessionInfo): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

// ── Event storage ─────────────────────────────────────────────────────────────

function loadEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : []
  } catch {
    return []
  }
}

function persistEvents(events: AnalyticsEvent[]): void {
  // Keep only the most recent MAX_EVENTS to bound storage usage
  const trimmed = events.slice(-MAX_EVENTS)
  localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed))
}

// ── Core tracker ──────────────────────────────────────────────────────────────

export const analytics = {
  /**
   * Track an arbitrary event.
   */
  track(
    category: EventCategory,
    action: string,
    options: {
      label?: string
      value?: number
      userId?: string
      metadata?: Record<string, unknown>
    } = {}
  ): AnalyticsEvent {
    const session = getSession()
    const event: AnalyticsEvent = {
      id: generateId(),
      category,
      action,
      label: options.label,
      value: options.value,
      userId: options.userId,
      sessionId: session.sessionId,
      timestamp: Date.now(),
      metadata: options.metadata
    }
    const events = loadEvents()
    events.push(event)
    persistEvents(events)
    session.events += 1
    saveSession(session)
    return event
  },

  /** Track a page view. */
  pageView(page: string, userId?: string): AnalyticsEvent {
    const session = getSession()
    session.pageViews += 1
    saveSession(session)
    return analytics.track('navigation', 'page_view', { label: page, userId })
  },

  /** Retrieve all stored events, optionally filtered. */
  getEvents(
    filter?: Partial<Pick<AnalyticsEvent, 'category' | 'action' | 'userId'>>
  ): AnalyticsEvent[] {
    let events = loadEvents()
    if (filter?.category) events = events.filter((e) => e.category === filter.category)
    if (filter?.action) events = events.filter((e) => e.action === filter.action)
    if (filter?.userId) events = events.filter((e) => e.userId === filter.userId)
    return events
  },

  /** Current session info. */
  getSession(): SessionInfo {
    return getSession()
  },

  /** Clear all stored events. */
  clearEvents(): void {
    localStorage.removeItem(EVENTS_KEY)
  },

  /** Events within a time window (ms from now). */
  getRecentEvents(windowMs: number): AnalyticsEvent[] {
    const cutoff = Date.now() - windowMs
    return loadEvents().filter((e) => e.timestamp >= cutoff)
  },

  /**
   * Simple funnel analysis: given ordered action names, compute
   * how many users reached each step.
   */
  getFunnelAnalysis(steps: string[]): FunnelStep[] {
    const events = loadEvents()
    const stepCounts = steps.map((step) => ({
      step,
      users: new Set(events.filter((e) => e.action === step).map((e) => e.sessionId)).size
    }))
    return stepCounts.map((s, i) => {
      const prev = i === 0 ? s.users : stepCounts[i - 1].users
      const dropOff = prev - s.users
      const conversionRate = prev === 0 ? 0 : Math.round((s.users / stepCounts[0].users) * 100)
      return { name: s.step, count: s.users, dropOff, conversionRate }
    })
  },

  /**
   * Cohort analysis: group events by day and action, returning
   * daily counts for the given action over the last N days.
   */
  getDailycounts(action: string, days = 7): { date: string; count: number }[] {
    const events = loadEvents().filter((e) => e.action === action)
    const result: { date: string; count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const count = events.filter(
        (e) => new Date(e.timestamp).toISOString().slice(0, 10) === dateStr
      ).length
      result.push({ date: dateStr, count })
    }
    return result
  },

  /**
   * User journey: returns the sequence of unique actions for a session.
   */
  getUserJourney(sessionId: string): string[] {
    return loadEvents()
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => e.action)
  }
}
