import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSearch } from '@/hooks/useSearch'
import { SearchPanel } from '@/components/ui/SearchPanel'
import { WasteDetailsModal } from '@/components/modals/WasteDetailsModal'
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/searchStorage'
import type { SearchFilters } from '@/lib/searchStorage'
import type { Waste } from '@/api/types'

const PAGE_SIZE = 10

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialise query + filters from URL on mount
  const { query: initialQuery, filters: initialFilters } = searchParamsToFilters(searchParams)

  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [wastePage, setWastePage] = useState(1)
  const [participantPage, setParticipantPage] = useState(1)
  const [selectedWaste, setSelectedWaste] = useState<Waste | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const query = initialQuery

  // Sync URL whenever filters change
  useEffect(() => {
    const next = filtersToSearchParams(query, filters)
    setSearchParams(next, { replace: true })
    // Reset pagination when filters change
    setWastePage(1)
    setParticipantPage(1)
  }, [filters, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useSearch(query, filters)

  const wastes = results.filter((r) => r.type === 'waste')
  const participants = results.filter((r) => r.type === 'participant')

  const pagedWastes = wastes.slice(0, wastePage * PAGE_SIZE)
  const pagedParticipants = participants.slice(0, participantPage * PAGE_SIZE)

  function openWasteModal(waste: Waste) {
    setSelectedWaste(waste)
    setModalOpen(true)
  }

  function handleFiltersChange(next: SearchFilters) {
    setFilters(next)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Search Results</h1>
        {query && (
          <p className="mt-1 text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Advanced filters panel */}
      <SearchPanel filters={filters} onChange={handleFiltersChange} />

      {/* Empty state */}
      {results.length === 0 && query && (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">
            No results found for &ldquo;{query}&rdquo;. Try broadening your search.
          </p>
        </div>
      )}

      {/* Waste Items section */}
      {wastes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Waste Items ({wastes.length})</h2>
          <ul className="space-y-2">
            {pagedWastes.map((r) => (
              <li
                key={r.id}
                className="cursor-pointer rounded-md border p-3 transition-colors hover:bg-accent"
                onClick={() => openWasteModal(r.data as Waste)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openWasteModal(r.data as Waste)
                }}
              >
                <p className="font-medium">{r.label}</p>
                <p className="text-sm text-muted-foreground">{r.sublabel}</p>
              </li>
            ))}
          </ul>
          {pagedWastes.length < wastes.length && (
            <button
              className="mt-3 text-sm text-primary hover:underline"
              onClick={() => setWastePage((p) => p + 1)}
            >
              Show more ({wastes.length - pagedWastes.length} remaining)
            </button>
          )}
        </section>
      )}

      {/* Participants section */}
      {participants.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Participants ({participants.length})</h2>
          <ul className="space-y-2">
            {pagedParticipants.map((r) => (
              <li key={r.id} className="rounded-md border p-3">
                <p className="font-medium">{r.label}</p>
                <p className="text-sm text-muted-foreground">{r.sublabel}</p>
              </li>
            ))}
          </ul>
          {pagedParticipants.length < participants.length && (
            <button
              className="mt-3 text-sm text-primary hover:underline"
              onClick={() => setParticipantPage((p) => p + 1)}
            >
              Show more ({participants.length - pagedParticipants.length} remaining)
            </button>
          )}
        </section>
      )}

      {/* WasteDetailsModal */}
      <WasteDetailsModal
        waste={selectedWaste}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedWaste(null)
        }}
      />
    </div>
  )
}
