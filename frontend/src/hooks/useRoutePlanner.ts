import { useState, useCallback } from 'react'
import { WasteMapPoint } from './useMapData'

export interface RouteStop {
  id: string
  lat: number
  lng: number
  label: string
  wastePoint?: WasteMapPoint
}

export interface SavedRoute {
  id: string
  name: string
  stops: RouteStop[]
  totalDistanceKm: number
  estimatedMinutes: number
  createdAt: number
}

export interface RouteResult {
  orderedStops: RouteStop[]
  totalDistanceKm: number
  estimatedMinutes: number
  directions: string[]
}

/** Haversine distance in km between two lat/lng points */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/** Nearest-neighbour TSP heuristic */
export function optimizeRoute(stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 1) return stops
  const remaining = [...stops]
  const ordered: RouteStop[] = [remaining.shift()!]
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1]
    let nearestIdx = 0
    let nearestDist = Infinity
    remaining.forEach((s, i) => {
      const d = haversineKm(last.lat, last.lng, s.lat, s.lng)
      if (d < nearestDist) {
        nearestDist = d
        nearestIdx = i
      }
    })
    ordered.push(remaining.splice(nearestIdx, 1)[0])
  }
  return ordered
}

export function computeRouteStats(stops: RouteStop[]): {
  totalDistanceKm: number
  estimatedMinutes: number
} {
  let totalDistanceKm = 0
  for (let i = 1; i < stops.length; i++) {
    totalDistanceKm += haversineKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng)
  }
  // Assume avg 40 km/h + 5 min per stop
  const estimatedMinutes = Math.round((totalDistanceKm / 40) * 60 + stops.length * 5)
  return { totalDistanceKm: Math.round(totalDistanceKm * 10) / 10, estimatedMinutes }
}

export function buildDirections(stops: RouteStop[]): string[] {
  if (stops.length === 0) return []
  const dirs: string[] = [`Start at ${stops[0].label}`]
  for (let i = 1; i < stops.length; i++) {
    const dist = haversineKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng)
    dirs.push(`Head to ${stops[i].label} (~${dist.toFixed(1)} km)`)
  }
  dirs.push('Route complete')
  return dirs
}

const STORAGE_KEY = 'scavngr_saved_routes'

function loadSavedRoutes(): SavedRoute[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persistRoutes(routes: SavedRoute[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes))
}

export function useRoutePlanner() {
  const [selectedStops, setSelectedStops] = useState<RouteStop[]>([])
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(loadSavedRoutes)

  const addStop = useCallback((stop: RouteStop) => {
    setSelectedStops((prev) => (prev.find((s) => s.id === stop.id) ? prev : [...prev, stop]))
    setRouteResult(null)
  }, [])

  const removeStop = useCallback((id: string) => {
    setSelectedStops((prev) => prev.filter((s) => s.id !== id))
    setRouteResult(null)
  }, [])

  const clearStops = useCallback(() => {
    setSelectedStops([])
    setRouteResult(null)
  }, [])

  const optimizeAndPlan = useCallback(() => {
    if (selectedStops.length === 0) return
    const orderedStops = optimizeRoute(selectedStops)
    const { totalDistanceKm, estimatedMinutes } = computeRouteStats(orderedStops)
    const directions = buildDirections(orderedStops)
    setRouteResult({ orderedStops, totalDistanceKm, estimatedMinutes, directions })
  }, [selectedStops])

  const saveRoute = useCallback(
    (name: string) => {
      if (!routeResult) return
      const route: SavedRoute = {
        id: `route_${Date.now()}`,
        name,
        stops: routeResult.orderedStops,
        totalDistanceKm: routeResult.totalDistanceKm,
        estimatedMinutes: routeResult.estimatedMinutes,
        createdAt: Date.now()
      }
      setSavedRoutes((prev) => {
        const updated = [route, ...prev]
        persistRoutes(updated)
        return updated
      })
      return route
    },
    [routeResult]
  )

  const loadRoute = useCallback((route: SavedRoute) => {
    setSelectedStops(route.stops)
    const directions = buildDirections(route.stops)
    setRouteResult({
      orderedStops: route.stops,
      totalDistanceKm: route.totalDistanceKm,
      estimatedMinutes: route.estimatedMinutes,
      directions
    })
  }, [])

  const deleteRoute = useCallback((id: string) => {
    setSavedRoutes((prev) => {
      const updated = prev.filter((r) => r.id !== id)
      persistRoutes(updated)
      return updated
    })
  }, [])

  const shareRoute = useCallback((route: SavedRoute | RouteResult) => {
    const stops = 'orderedStops' in route ? route.orderedStops : (route as SavedRoute).stops
    const text = stops
      .map((s, i) => `${i + 1}. ${s.label} (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`)
      .join('\n')
    return `Scavngr Route:\n${text}`
  }, [])

  return {
    selectedStops,
    routeResult,
    savedRoutes,
    addStop,
    removeStop,
    clearStops,
    optimizeAndPlan,
    saveRoute,
    loadRoute,
    deleteRoute,
    shareRoute
  }
}
