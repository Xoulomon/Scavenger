import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SearchResultsPage } from '@/pages/SearchResultsPage'
import type { Waste } from '@/api/types'
import { WasteType, Role } from '@/api/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/modals/WasteDetailsModal', () => ({
  WasteDetailsModal: ({ open, waste }: { open: boolean; waste: Waste | null }) =>
    open && waste ? (
      <div data-testid="waste-modal">Modal: Waste #{waste.waste_id.toString()}</div>
    ) : null,
}))

// Mock useSearch to return controlled results
const mockUseSearch = vi.fn()
vi.mock('@/hooks/useSearch', () => ({
  useSearch: (...args: unknown[]) => mockUseSearch(...args),
  useDebounce: (v: unknown) => v,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWaste(id: number): Waste {
  return {
    waste_id: BigInt(id),
    waste_type: WasteType.Paper,
    weight: BigInt(100),
    current_owner: `GOWNER${id}`,
    latitude: BigInt(0),
    longitude: BigInt(0),
    recycled_timestamp: 0,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
  }
}

function makeWasteResult(id: number) {
  const waste = makeWaste(id)
  return {
    type: 'waste' as const,
    id: String(id),
    label: `Waste #${id}`,
    sublabel: `GOWNER${id}`,
    data: waste,
  }
}

function makeParticipantResult(id: number) {
  return {
    type: 'participant' as const,
    id: `GADDR${id}`,
    label: `Participant ${id}`,
    sublabel: `GADDR${id}`,
    data: {
      address: `GADDR${id}`,
      role: Role.Recycler,
      name: `Participant ${id}`,
      latitude: 0,
      longitude: 0,
      registered_at: 0,
    },
  }
}

function renderPage(search = '?q=test') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/search${search}`]}>
        <Routes>
          <Route path="/search" element={<SearchResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchResultsPage', () => {
  beforeEach(() => {
    mockUseSearch.mockReturnValue([])
  })

  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /search results/i })).toBeInTheDocument()
  })

  it('shows result count when query is present', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(1), makeWasteResult(2)])
    renderPage('?q=test')
    expect(screen.getByText(/2 results for/i)).toBeInTheDocument()
  })

  it('shows singular "result" for exactly 1 match', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(1)])
    renderPage('?q=test')
    expect(screen.getByText(/1 result for/i)).toBeInTheDocument()
  })

  it('shows empty state when no results and query is present', () => {
    mockUseSearch.mockReturnValue([])
    renderPage('?q=notfound')
    expect(screen.getByText(/no results found/i)).toBeInTheDocument()
  })

  it('does not show empty state when query is absent', () => {
    mockUseSearch.mockReturnValue([])
    renderPage('')
    expect(screen.queryByText(/no results found/i)).not.toBeInTheDocument()
  })

  it('renders waste items section when wastes exist', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(1), makeWasteResult(2)])
    renderPage()
    expect(screen.getByRole('heading', { name: /waste items/i })).toBeInTheDocument()
    expect(screen.getByText('Waste #1')).toBeInTheDocument()
    expect(screen.getByText('Waste #2')).toBeInTheDocument()
  })

  it('renders participants section when participants exist', () => {
    mockUseSearch.mockReturnValue([makeParticipantResult(1)])
    renderPage()
    expect(screen.getByRole('heading', { name: /participants/i })).toBeInTheDocument()
    expect(screen.getByText('Participant 1')).toBeInTheDocument()
  })

  it('does not render waste section when no wastes', () => {
    mockUseSearch.mockReturnValue([makeParticipantResult(1)])
    renderPage()
    expect(screen.queryByRole('heading', { name: /waste items/i })).not.toBeInTheDocument()
  })

  it('does not render participants section when no participants', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(1)])
    renderPage()
    expect(screen.queryByRole('heading', { name: /participants/i })).not.toBeInTheDocument()
  })

  it('shows "Show more" button when wastes exceed page size', () => {
    const results = Array.from({ length: 12 }, (_, i) => makeWasteResult(i + 1))
    mockUseSearch.mockReturnValue(results)
    renderPage()
    expect(screen.getByText(/show more/i)).toBeInTheDocument()
  })

  it('does not show "Show more" when results fit on one page', () => {
    const results = Array.from({ length: 5 }, (_, i) => makeWasteResult(i + 1))
    mockUseSearch.mockReturnValue(results)
    renderPage()
    expect(screen.queryByText(/show more/i)).not.toBeInTheDocument()
  })

  it('clicking "Show more" reveals additional waste items', () => {
    const results = Array.from({ length: 12 }, (_, i) => makeWasteResult(i + 1))
    mockUseSearch.mockReturnValue(results)
    renderPage()

    // Initially only 10 shown
    expect(screen.queryByText('Waste #11')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/show more/i))

    // After clicking, item 11 should appear
    expect(screen.getByText('Waste #11')).toBeInTheDocument()
  })

  it('opens waste modal when clicking a waste item', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(5)])
    renderPage()

    fireEvent.click(screen.getByText('Waste #5'))
    expect(screen.getByTestId('waste-modal')).toBeInTheDocument()
    expect(screen.getByText(/Modal: Waste #5/)).toBeInTheDocument()
  })

  it('opens waste modal on Enter key press', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(3)])
    renderPage()

    const item = screen.getByText('Waste #3').closest('[role="button"]')!
    fireEvent.keyDown(item, { key: 'Enter' })
    expect(screen.getByTestId('waste-modal')).toBeInTheDocument()
  })

  it('opens waste modal on Space key press', () => {
    mockUseSearch.mockReturnValue([makeWasteResult(3)])
    renderPage()

    const item = screen.getByText('Waste #3').closest('[role="button"]')!
    fireEvent.keyDown(item, { key: ' ' })
    expect(screen.getByTestId('waste-modal')).toBeInTheDocument()
  })

  it('renders the SearchPanel (advanced filters)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /advanced filters/i })).toBeInTheDocument()
  })
})
