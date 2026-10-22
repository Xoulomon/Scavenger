import { describe, it, expect, beforeEach } from 'vitest'
import { analytics } from './analyticsService'

beforeEach(() => {
  analytics.clearEvents()
  sessionStorage.clear()
})

describe('analytics.track', () => {
  it('records an event and returns it', () => {
    const e = analytics.track('waste', 'waste_submit', { label: 'plastic' })
    expect(e.category).toBe('waste')
    expect(e.action).toBe('waste_submit')
    expect(e.label).toBe('plastic')
    expect(typeof e.id).toBe('string')
    expect(typeof e.sessionId).toBe('string')
  })

  it('stores events in localStorage', () => {
    analytics.track('ui', 'button_click')
    const stored = analytics.getEvents()
    expect(stored.length).toBe(1)
  })

  it('associates optional userId', () => {
    const e = analytics.track('wallet', 'wallet_connect', { userId: 'user123' })
    expect(e.userId).toBe('user123')
  })
})

describe('analytics.pageView', () => {
  it('tracks page_view action under navigation category', () => {
    analytics.pageView('/home')
    const events = analytics.getEvents({ action: 'page_view' })
    expect(events.length).toBe(1)
    expect(events[0].label).toBe('/home')
    expect(events[0].category).toBe('navigation')
  })
})

describe('analytics.getEvents', () => {
  it('filters by category', () => {
    analytics.track('waste', 'waste_submit')
    analytics.track('rewards', 'rewards_claim')
    const wasteEvents = analytics.getEvents({ category: 'waste' })
    expect(wasteEvents.length).toBe(1)
    expect(wasteEvents[0].category).toBe('waste')
  })

  it('filters by action', () => {
    analytics.track('waste', 'waste_submit')
    analytics.track('waste', 'waste_verify')
    const events = analytics.getEvents({ action: 'waste_submit' })
    expect(events.length).toBe(1)
  })

  it('returns all events when no filter', () => {
    analytics.track('ui', 'click')
    analytics.track('search', 'search_query')
    expect(analytics.getEvents().length).toBe(2)
  })
})

describe('analytics.getRecentEvents', () => {
  it('returns events within the time window', () => {
    analytics.track('ui', 'click')
    const recent = analytics.getRecentEvents(60_000)
    expect(recent.length).toBe(1)
  })

  it('excludes events outside the window', () => {
    analytics.track('ui', 'old_click')
    // window of -1ms means cutoff is in the future, so no events qualify
    const recent = analytics.getRecentEvents(-1)
    expect(recent.length).toBe(0)
  })
})

describe('analytics.getFunnelAnalysis', () => {
  it('returns steps with correct structure', () => {
    analytics.track('navigation', 'page_view')
    analytics.track('waste', 'waste_submit')
    const funnel = analytics.getFunnelAnalysis(['page_view', 'waste_submit', 'rewards_claim'])
    expect(funnel.length).toBe(3)
    expect(funnel[0].name).toBe('page_view')
    expect(typeof funnel[0].conversionRate).toBe('number')
    expect(typeof funnel[0].dropOff).toBe('number')
  })

  it('first step always has 100% conversion', () => {
    analytics.track('navigation', 'page_view')
    const funnel = analytics.getFunnelAnalysis(['page_view'])
    expect(funnel[0].conversionRate).toBe(100)
  })
})

describe('analytics.getDailycounts', () => {
  it('returns 7 entries by default', () => {
    const counts = analytics.getDailycounts('page_view')
    expect(counts.length).toBe(7)
  })

  it('counts today\'s events', () => {
    analytics.pageView('/home')
    const counts = analytics.getDailycounts('page_view')
    const today = new Date().toISOString().slice(0, 10)
    const todayEntry = counts.find((c) => c.date === today)
    expect(todayEntry?.count).toBe(1)
  })
})

describe('analytics.getUserJourney', () => {
  it('returns ordered actions for a session', () => {
    analytics.track('navigation', 'page_view')
    analytics.track('waste', 'waste_submit')
    const session = analytics.getSession()
    const journey = analytics.getUserJourney(session.sessionId)
    expect(journey).toContain('page_view')
    expect(journey).toContain('waste_submit')
    expect(journey.indexOf('page_view')).toBeLessThan(journey.indexOf('waste_submit'))
  })
})

describe('analytics.clearEvents', () => {
  it('removes all events', () => {
    analytics.track('ui', 'click')
    analytics.clearEvents()
    expect(analytics.getEvents().length).toBe(0)
  })
})
