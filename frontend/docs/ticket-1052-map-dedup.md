# Ticket #1052 — Deduplicate map marker/layer logic in `components/map`

**Status: out of scope as written.** `frontend/src/components/map` does not
exist in this repo. There is no mapping library installed (`leaflet`,
`mapbox-gl`, `react-map-gl`, `@react-google-maps/api`, etc. are all absent
from `frontend/package.json`), and no marker-rendering, clustering, or
layer-toggle code exists anywhere in the frontend to deduplicate.

## Recommendation

Close or re-scope this ticket until a map feature actually ships (e.g. a
collector/admin map view for waste pickup locations). Re-file it once there
are at least two map-consuming components sharing duplicated logic.

## Guidance for whoever builds the first map view

To avoid needing this refactor later, build map support against shared
utilities from the start rather than duplicating per-view:

- Put marker-icon and clustering logic in a plain utility module (e.g.
  `frontend/src/lib/mapMarkers.ts`) rather than inline in a component — it's
  pure logic, not state, so it doesn't belong in Context or React Query.
- Put layer-toggle state behind a `useMapLayers` hook
  (`frontend/src/hooks/useMapLayers.ts`) that owns which layers are active
  and exposes toggle actions, so every map view shares one implementation
  instead of reimplementing toggle state per screen.
- Keep map data itself (pickup locations, routes, etc.) in React Query if
  it's server-fetched — see `frontend/src/context/README.md` for the
  state-placement convention.
