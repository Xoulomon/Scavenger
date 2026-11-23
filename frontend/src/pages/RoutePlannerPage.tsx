import { useState } from 'react'
import { Navigation, Trash2, Play, Save, Share2, FolderOpen, X, MapPin } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useMapData } from '@/hooks/useMapData'
import { useRoutePlanner, RouteStop } from '@/hooks/useRoutePlanner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { wasteTypeLabel } from '@/lib/helpers'

export function RoutePlannerPage() {
  useAppTitle('Route Planner')
  const { wastes, isLoading } = useMapData()
  const {
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
  } = useRoutePlanner()

  const [saveName, setSaveName] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const [shareText, setShareText] = useState('')

  const handleAddWaste = (stop: RouteStop) => addStop(stop)

  const handleSave = () => {
    if (!saveName.trim()) return
    saveRoute(saveName.trim())
    setSaveName('')
  }

  const handleShare = () => {
    if (!routeResult) return
    const text = shareRoute(routeResult)
    setShareText(text)
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Navigation className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Route Planner</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: waste selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Waste Locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              )}
              {!isLoading && wastes.length === 0 && (
                <EmptyState
                  icon={MapPin}
                  title="No waste locations"
                  description="No waste items with coordinates found"
                />
              )}
              {wastes.map((w) => {
                const alreadyAdded = selectedStops.some((s) => s.id === w.id)
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{wasteTypeLabel(w.waste.waste_type)}</Badge>
                      <span className="text-muted-foreground">#{w.id}</span>
                      <span className="text-xs text-muted-foreground">
                        {w.lat.toFixed(3)}, {w.lng.toFixed(3)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={alreadyAdded ? 'ghost' : 'outline'}
                      disabled={alreadyAdded}
                      onClick={() =>
                        handleAddWaste({
                          id: w.id,
                          lat: w.lat,
                          lng: w.lng,
                          label: `${wasteTypeLabel(w.waste.waste_type)} #${w.id}`,
                          wastePoint: w
                        })
                      }
                    >
                      {alreadyAdded ? 'Added' : 'Add'}
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Saved routes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Saved Routes</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setShowSaved((v) => !v)}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {showSaved && (
              <CardContent className="space-y-2">
                {savedRoutes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No saved routes yet.</p>
                )}
                {savedRoutes.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.stops.length} stops · {r.totalDistanceKm} km · {r.estimatedMinutes} min
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => loadRoute(r)}>
                        Load
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRoute(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right: selected stops + result */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Selected Stops ({selectedStops.length})</CardTitle>
                {selectedStops.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearStops}>
                    <X className="h-4 w-4" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedStops.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add waste locations from the left panel.
                </p>
              )}
              {selectedStops.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {i + 1}
                    </span>
                    {s.label}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeStop(s.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {selectedStops.length > 0 && (
                <Button className="mt-2 w-full" onClick={optimizeAndPlan}>
                  <Play className="mr-2 h-4 w-4" /> Optimize Route
                </Button>
              )}
            </CardContent>
          </Card>

          {routeResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Route Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <div className="rounded-md bg-muted px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="font-bold">{routeResult.totalDistanceKm} km</p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Est. Time</p>
                    <p className="font-bold">{routeResult.estimatedMinutes} min</p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Stops</p>
                    <p className="font-bold">{routeResult.orderedStops.length}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Turn-by-turn Directions</p>
                  <ol className="space-y-1">
                    {routeResult.directions.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex gap-2">
                  <div className="flex flex-1 gap-2">
                    <input
                      className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                      placeholder="Route name…"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                    />
                    <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>
                      <Save className="mr-1 h-3 w-3" /> Save
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleShare}>
                    <Share2 className="mr-1 h-3 w-3" /> Share
                  </Button>
                </div>

                {shareText && (
                  <pre className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                    {shareText}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
