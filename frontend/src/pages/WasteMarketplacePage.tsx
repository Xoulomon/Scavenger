import { useState, useMemo } from 'react'
import {
  ShoppingCart,
  Tag,
  Search,
  Filter,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  History,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useAppTitle } from '@/hooks/useAppTitle'
import { WasteType } from '@/api/types'
import { wasteTypeLabel } from '@/lib/helpers'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OfferStatus = 'pending' | 'accepted' | 'rejected'

export interface MarketplaceListing {
  id: string
  seller: string
  wasteType: WasteType
  weight: number
  pricePerKg: number
  description: string
  listedAt: number
  rating: number
}

export interface MarketplaceOffer {
  id: string
  listingId: string
  buyer: string
  offerPrice: number
  status: OfferStatus
  createdAt: number
}

export interface RatingEntry {
  listingId: string
  rater: string
  score: number
  comment: string
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function filterListings(
  listings: MarketplaceListing[],
  query: string,
  wasteType: WasteType | 'all'
): MarketplaceListing[] {
  return listings.filter((l) => {
    const matchesType = wasteType === 'all' || l.wasteType === wasteType
    const matchesQuery =
      !query ||
      wasteTypeLabel(l.wasteType).toLowerCase().includes(query.toLowerCase()) ||
      l.seller.toLowerCase().includes(query.toLowerCase()) ||
      l.description.toLowerCase().includes(query.toLowerCase())
    return matchesType && matchesQuery
  })
}

export function sortListings(
  listings: MarketplaceListing[],
  sortBy: 'price_asc' | 'price_desc' | 'weight' | 'rating'
): MarketplaceListing[] {
  return [...listings].sort((a, b) => {
    if (sortBy === 'price_asc') return a.pricePerKg - b.pricePerKg
    if (sortBy === 'price_desc') return b.pricePerKg - a.pricePerKg
    if (sortBy === 'weight') return b.weight - a.weight
    if (sortBy === 'rating') return b.rating - a.rating
    return 0
  })
}

export function makeOffer(
  listing: MarketplaceListing,
  buyer: string,
  offerPrice: number
): MarketplaceOffer {
  return {
    id: `offer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    listingId: listing.id,
    buyer,
    offerPrice,
    status: 'pending',
    createdAt: Date.now(),
  }
}

export function respondToOffer(
  offer: MarketplaceOffer,
  decision: 'accepted' | 'rejected'
): MarketplaceOffer {
  return { ...offer, status: decision, respondedAt: Date.now() }
}

export function averageRating(ratings: RatingEntry[], listingId: string): number {
  const relevant = ratings.filter((r) => r.listingId === listingId)
  if (!relevant.length) return 0
  return relevant.reduce((sum, r) => sum + r.score, 0) / relevant.length
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_LISTINGS: MarketplaceListing[] = [
  {
    id: 'l1',
    seller: 'GAXYZ...ABC1',
    wasteType: WasteType.Paper,
    weight: 120,
    pricePerKg: 0.5,
    description: 'Clean office paper, sorted and baled.',
    listedAt: 1714000000,
    rating: 4.5,
  },
  {
    id: 'l2',
    seller: 'GBDEF...XYZ2',
    wasteType: WasteType.PetPlastic,
    weight: 80,
    pricePerKg: 1.2,
    description: 'PET bottles, washed and compressed.',
    listedAt: 1714050000,
    rating: 4.0,
  },
  {
    id: 'l3',
    seller: 'GCHIJ...LMN3',
    wasteType: WasteType.Metal,
    weight: 200,
    pricePerKg: 2.5,
    description: 'Mixed scrap metal, mostly aluminium.',
    listedAt: 1714100000,
    rating: 3.8,
  },
  {
    id: 'l4',
    seller: 'GDKLM...OPQ4',
    wasteType: WasteType.Glass,
    weight: 150,
    pricePerKg: 0.3,
    description: 'Clear glass bottles, sorted by colour.',
    listedAt: 1714150000,
    rating: 4.2,
  },
  {
    id: 'l5',
    seller: 'GENOP...RST5',
    wasteType: WasteType.Plastic,
    weight: 60,
    pricePerKg: 0.9,
    description: 'Mixed rigid plastics, cleaned.',
    listedAt: 1714200000,
    rating: 3.5,
  },
]

const MOCK_OFFERS: MarketplaceOffer[] = [
  {
    id: 'o1',
    listingId: 'l1',
    buyer: 'GBUYER...001',
    offerPrice: 55,
    status: 'accepted',
    createdAt: 1714010000,
  },
  {
    id: 'o2',
    listingId: 'l2',
    buyer: 'GBUYER...002',
    offerPrice: 90,
    status: 'pending',
    createdAt: 1714060000,
  },
  {
    id: 'o3',
    listingId: 'l3',
    buyer: 'GBUYER...003',
    offerPrice: 480,
    status: 'rejected',
    createdAt: 1714110000,
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-sm text-yellow-500">
      <Star className="h-3.5 w-3.5 fill-yellow-500" />
      {rating.toFixed(1)}
    </span>
  )
}

function OfferStatusBadge({ status }: { status: OfferStatus }) {
  if (status === 'accepted')
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle className="h-3 w-3" /> Accepted
      </Badge>
    )
  if (status === 'rejected')
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  )
}

function ListingCard({
  listing,
  onMakeOffer,
}: {
  listing: MarketplaceListing
  onMakeOffer: (listing: MarketplaceListing) => void
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{wasteTypeLabel(listing.wasteType)}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{listing.seller}</p>
          </div>
          <Badge variant="outline">{listing.weight} kg</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-muted-foreground">{listing.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            ${listing.pricePerKg.toFixed(2)}/kg
          </span>
          <StarRating rating={listing.rating} />
        </div>
        <Button size="sm" className="mt-auto w-full" onClick={() => onMakeOffer(listing)}>
          <Tag className="mr-1.5 h-4 w-4" />
          Make Offer
        </Button>
      </CardContent>
    </Card>
  )
}

function MakeOfferModal({
  listing,
  onClose,
  onSubmit,
}: {
  listing: MarketplaceListing
  onClose: () => void
  onSubmit: (price: number) => void
}) {
  const [price, setPrice] = useState('')
  const suggested = (listing.weight * listing.pricePerKg).toFixed(2)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Make offer"
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Make an Offer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {wasteTypeLabel(listing.wasteType)} · {listing.weight} kg · Asking{' '}
            <strong>${suggested}</strong>
          </p>
          <div>
            <label htmlFor="offer-price" className="mb-1 block text-sm font-medium">
              Your offer (USD)
            </label>
            <Input
              id="offer-price"
              type="number"
              min="0"
              step="0.01"
              placeholder={suggested}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!price || Number(price) <= 0}
              onClick={() => onSubmit(Number(price))}
            >
              Submit Offer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WasteMarketplacePage() {
  useAppTitle('Waste Marketplace')

  const [query, setQuery] = useState('')
  const [wasteTypeFilter, setWasteTypeFilter] = useState<WasteType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'weight' | 'rating'>(
    'price_asc'
  )
  const [offers, setOffers] = useState<MarketplaceOffer[]>(MOCK_OFFERS)
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [activeTab, setActiveTab] = useState<'browse' | 'history'>('browse')
  const [toast, setToast] = useState<string | null>(null)

  const filtered = useMemo(
    () => filterListings(MOCK_LISTINGS, query, wasteTypeFilter),
    [query, wasteTypeFilter]
  )
  const sorted = useMemo(() => sortListings(filtered, sortBy), [filtered, sortBy])

  function handleMakeOffer(listing: MarketplaceListing) {
    setSelectedListing(listing)
  }

  function handleSubmitOffer(price: number) {
    if (!selectedListing) return
    const offer = makeOffer(selectedListing, 'GSELF...0000', price)
    setOffers((prev) => [offer, ...prev])
    setSelectedListing(null)
    setToast('Offer submitted successfully!')
    setTimeout(() => setToast(null), 3000)
  }

  function handleRespond(offerId: string, decision: 'accepted' | 'rejected') {
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? respondToOffer(o, decision) : o))
    )
  }

  const ALL_WASTE_TYPES = Object.values(WasteType).filter(
    (v): v is WasteType => typeof v === 'number'
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Waste Marketplace</h1>
        <p className="mt-1 text-muted-foreground">
          Buy and sell recyclable materials directly with other participants
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-700 dark:text-green-400"
        >
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'browse' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('browse')}
        >
          <ShoppingCart className="mr-1.5 inline h-4 w-4" />
          Browse Listings
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('history')}
        >
          <History className="mr-1.5 inline h-4 w-4" />
          Transaction History
        </button>
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search listings…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search listings"
              />
            </div>
            <Select
              value={wasteTypeFilter === 'all' ? 'all' : String(wasteTypeFilter)}
              onValueChange={(v) =>
                setWasteTypeFilter(v === 'all' ? 'all' : (Number(v) as WasteType))
              }
            >
              <SelectTrigger className="w-40" aria-label="Filter by waste type">
                <Filter className="mr-1.5 h-4 w-4" />
                <SelectValue placeholder="Waste type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ALL_WASTE_TYPES.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {wasteTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-44" aria-label="Sort listings">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_asc">Price: Low → High</SelectItem>
                <SelectItem value="price_desc">Price: High → Low</SelectItem>
                <SelectItem value="weight">Heaviest first</SelectItem>
                <SelectItem value="rating">Best rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Listings grid */}
          {sorted.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No listings match your filters.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((listing) => (
                <ListingCard key={listing.id} listing={listing} onMakeOffer={handleMakeOffer} />
              ))}
            </div>
          )}

          {/* List your own waste CTA */}
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <Plus className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Have recyclable waste to sell? List it on the marketplace.
              </p>
              <Button variant="outline" size="sm">
                List Your Waste
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {offers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No transactions yet.</div>
          ) : (
            offers.map((offer) => {
              const listing = MOCK_LISTINGS.find((l) => l.id === offer.listingId)
              return (
                <Card key={offer.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">
                        {listing ? wasteTypeLabel(listing.wasteType) : offer.listingId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Buyer: {offer.buyer} · Offer: ${offer.offerPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OfferStatusBadge status={offer.status} />
                      {offer.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRespond(offer.id, 'accepted')}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRespond(offer.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Make offer modal */}
      {selectedListing && (
        <MakeOfferModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onSubmit={handleSubmitOffer}
        />
      )}
    </div>
  )
}
