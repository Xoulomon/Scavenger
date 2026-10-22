import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  haversineKm,
  optimizeRoute,
  computeRouteStats,
  buildDirections,
  useRoutePlanner,
  RouteStop,
} from '@/hooks/useRoutePlanner'

// ── Pure function tests ───────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0)
  })

  it('returns ~111 km per degree of latitude', () => {
    const d = haversineKm(0, 0, 1, 0)
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })

  it('is symmetric', () => {
    const d1 = haversineKm(10, 20, 30, 40)
    const d2 = haversineKm(30, 40, 10, 20)
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001)
  })

  it('handles negative coordinates', () => {
    const d = haversineKm(-33.87, 151.21, -37.81, 144.96) // Sydney to Melbourne
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(800)
  })
})

describe('optimizeRoute', () => {
  const stops: RouteStop[] = [
    { id: 'a', lat: 0, lng: 0, label: 'A' },
    { id: 'b', lat: 10, lng: 0, label: 'B' },
    { id: 'c', lat: 5, lng: 0, label: 'C' },
  ]

  it('returns empty array for empty input', () => {
    expect(optimizeRoute([])).toEqual([])
  })

  it('returns single stop unchanged', () => {
    expect(optimizeRoute([stops[0]])).toEqual([stops[0]])
  })

  it('starts with the first stop', () => {
    const result = optimizeRoute(stops)
    expect(result[0].id).toBe('a')
  })

  it('visits nearest neighbour next (C is closer to A than B)', () => {
    const result = optimizeRoute(stops)
    expect(result[1].id).toBe('c')
    expect(result[2].id).toBe('b')
  })

  it('returns all stops', () => {
    const result = optimizeRoute(stops)
    expect(result).toHaveLength(stops.length)
  })
})

describe('computeRouteStats', () => {
  it('returns 0 distance and 0 minutes for empty stops', () => {
    const { totalDistanceKm, estimatedMinutes } = computeRouteStats([])
    expect(totalDistanceKm).toBe(0)
    expect(estimatedMinutes).toBe(0)
  })

  it('returns 0 distance for single stop but adds per-stop time', () => {
    const { totalDistanceKm, estimatedMinutes } = computeRouteStats([
      { id: 'a', lat: 0, lng: 0, label: 'A' },
    ])
    expect(totalDistanceKm).toBe(0)
    expect(estimatedMinutes).toBe(5) // 1 stop × 5 min
  })

  it('computes distance for two stops', () => {
    const { totalDistanceKm } = computeRouteStats([
      { id: 'a', lat: 0, lng: 0, label: 'A' },
      { id: 'b', lat: 1, lng: 0, label: 'B' },
    ])
    expect(totalDistanceKm).toBeGreaterThan(110)
    expect(totalDistanceKm).toBeLessThan(112)
  })
})

describe('buildDirections', () => {
  it('returns empty array for no stops', () => {
    expect(buildDirections([])).toEqual([])
  })

  it('starts with "Start at" for first stop', () => {
    const dirs = buildDirections([{ id: 'a', lat: 0, lng: 0, label: 'Home' }])
    expect(dirs[0]).toContain('Start at Home')
  })

  it('ends with "Route complete"', () => {
    const dirs = buildDirections([
      { id: 'a', lat: 0, lng: 0, label: 'A' },
      { id: 'b', lat: 1, lng: 0, label: 'B' },
    ])
    expect(dirs[dirs.length - 1]).toBe('Route complete')
  })

  it('includes intermediate stop labels', () => {
    const dirs = buildDirections([
      { id: 'a', lat: 0, lng: 0, label: 'Alpha' },
      { id: 'b', lat: 1, lng: 0, label: 'Beta' },
    ])
    expect(dirs[1]).toContain('Beta')
  })
})

// ── Hook tests ────────────────────────────────────────────────────────────────

const mockStop = (id: string): RouteStop => ({ id, lat: Number(id), lng: 0, label: `Stop ${id}` })

describe('useRoutePlanner hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts with empty stops and no result', () => {
    const { result } = renderHook(() => useRoutePlanner())
    expect(result.current.selectedStops).toHaveLength(0)
    expect(result.current.routeResult).toBeNull()
  })

  it('addStop adds a stop', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    expect(result.current.selectedStops).toHaveLength(1)
  })

  it('addStop does not add duplicate', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.addStop(mockStop('1')))
    expect(result.current.selectedStops).toHaveLength(1)
  })

  it('removeStop removes a stop', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.removeStop('1'))
    expect(result.current.selectedStops).toHaveLength(0)
  })

  it('clearStops empties all stops', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.addStop(mockStop('2')))
    act(() => result.current.clearStops())
    expect(result.current.selectedStops).toHaveLength(0)
  })

  it('optimizeAndPlan produces a route result', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.addStop(mockStop('2')))
    act(() => result.current.optimizeAndPlan())
    expect(result.current.routeResult).not.toBeNull()
    expect(result.current.routeResult?.orderedStops).toHaveLength(2)
  })

  it('saveRoute persists to localStorage', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.optimizeAndPlan())
    act(() => result.current.saveRoute('My Route'))
    expect(result.current.savedRoutes).toHaveLength(1)
    expect(result.current.savedRoutes[0].name).toBe('My Route')
    expect(localStorage.getItem('scavngr_saved_routes')).not.toBeNull()
  })

  it('deleteRoute removes from savedRoutes', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.optimizeAndPlan())
    act(() => result.current.saveRoute('Route A'))
    const id = result.current.savedRoutes[0].id
    act(() => result.current.deleteRoute(id))
    expect(result.current.savedRoutes).toHaveLength(0)
  })

  it('loadRoute restores stops and result', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.addStop(mockStop('2')))
    act(() => result.current.optimizeAndPlan())
    act(() => result.current.saveRoute('Saved'))
    const saved = result.current.savedRoutes[0]
    act(() => result.current.clearStops())
    act(() => result.current.loadRoute(saved))
    expect(result.current.selectedStops).toHaveLength(2)
    expect(result.current.routeResult).not.toBeNull()
  })

  it('shareRoute returns a string with stop labels', () => {
    const { result } = renderHook(() => useRoutePlanner())
    act(() => result.current.addStop(mockStop('1')))
    act(() => result.current.optimizeAndPlan())
    const text = result.current.shareRoute(result.current.routeResult!)
    expect(text).toContain('Stop 1')
  })
})
