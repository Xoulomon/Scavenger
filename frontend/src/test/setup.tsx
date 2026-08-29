import React from 'react'
import '@testing-library/jest-dom'
import { server } from './msw/server'

// ── MSW lifecycle ──────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Leaflet stubs (jsdom cannot handle Leaflet DOM APIs) ───────
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({ isValid: () => true }))
  },
  divIcon: vi.fn(() => ({}))
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() })
}))

vi.mock('react-leaflet-markercluster', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cluster">{children}</div>
  )
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}))
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}))
