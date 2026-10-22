// Feature: Waste Marketplace (#429)
// Tests: filterListings, sortListings, makeOffer, respondToOffer, averageRating

import { describe, it, expect } from 'vitest'
import { WasteType } from '@/api/types'
import {
  filterListings,
  sortListings,
  makeOffer,
  respondToOffer,
  averageRating,
  type MarketplaceListing,
  type RatingEntry,
} from './WasteMarketplacePage'

const listings: MarketplaceListing[] = [
  {
    id: 'l1',
    seller: 'GABC',
    wasteType: WasteType.Paper,
    weight: 100,
    pricePerKg: 0.5,
    description: 'clean paper',
    listedAt: 1000,
    rating: 4.0,
  },
  {
    id: 'l2',
    seller: 'GDEF',
    wasteType: WasteType.Metal,
    weight: 200,
    pricePerKg: 2.0,
    description: 'scrap metal',
    listedAt: 2000,
    rating: 3.0,
  },
  {
    id: 'l3',
    seller: 'GHIJ',
    wasteType: WasteType.Paper,
    weight: 50,
    pricePerKg: 1.0,
    description: 'newspaper',
    listedAt: 3000,
    rating: 5.0,
  },
]

describe('WasteMarketplacePage — filterListings', () => {
  it('returns all listings when no filter applied', () => {
    expect(filterListings(listings, '', 'all')).toHaveLength(3)
  })

  it('filters by waste type', () => {
    const result = filterListings(listings, '', WasteType.Paper)
    expect(result).toHaveLength(2)
    result.forEach((l) => expect(l.wasteType).toBe(WasteType.Paper))
  })

  it('filters by query matching description', () => {
    const result = filterListings(listings, 'metal', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l2')
  })

  it('filters by query matching seller', () => {
    const result = filterListings(listings, 'GABC', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l1')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterListings(listings, 'zzznomatch', 'all')).toHaveLength(0)
  })

  it('combines type and query filters', () => {
    const result = filterListings(listings, 'newspaper', WasteType.Paper)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l3')
  })
})

describe('WasteMarketplacePage — sortListings', () => {
  it('sorts by price ascending', () => {
    const result = sortListings(listings, 'price_asc')
    expect(result[0].pricePerKg).toBeLessThanOrEqual(result[1].pricePerKg)
    expect(result[1].pricePerKg).toBeLessThanOrEqual(result[2].pricePerKg)
  })

  it('sorts by price descending', () => {
    const result = sortListings(listings, 'price_desc')
    expect(result[0].pricePerKg).toBeGreaterThanOrEqual(result[1].pricePerKg)
  })

  it('sorts by weight descending', () => {
    const result = sortListings(listings, 'weight')
    expect(result[0].weight).toBeGreaterThanOrEqual(result[1].weight)
  })

  it('sorts by rating descending', () => {
    const result = sortListings(listings, 'rating')
    expect(result[0].rating).toBeGreaterThanOrEqual(result[1].rating)
  })

  it('does not mutate original array', () => {
    const original = [...listings]
    sortListings(listings, 'price_desc')
    expect(listings).toEqual(original)
  })
})

describe('WasteMarketplacePage — makeOffer', () => {
  it('creates a pending offer with correct fields', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 45)
    expect(offer.listingId).toBe('l1')
    expect(offer.buyer).toBe('GBUYER')
    expect(offer.offerPrice).toBe(45)
    expect(offer.status).toBe('pending')
    expect(offer.id).toBeTruthy()
  })

  it('generates unique ids for different offers', () => {
    const o1 = makeOffer(listings[0], 'GBUYER', 10)
    const o2 = makeOffer(listings[0], 'GBUYER', 10)
    expect(o1.id).not.toBe(o2.id)
  })
})

describe('WasteMarketplacePage — respondToOffer', () => {
  it('accepts an offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    const updated = respondToOffer(offer, 'accepted')
    expect(updated.status).toBe('accepted')
  })

  it('rejects an offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    const updated = respondToOffer(offer, 'rejected')
    expect(updated.status).toBe('rejected')
  })

  it('does not mutate original offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    respondToOffer(offer, 'accepted')
    expect(offer.status).toBe('pending')
  })
})

describe('WasteMarketplacePage — averageRating', () => {
  const ratings: RatingEntry[] = [
    { listingId: 'l1', rater: 'G1', score: 4, comment: '' },
    { listingId: 'l1', rater: 'G2', score: 2, comment: '' },
    { listingId: 'l2', rater: 'G3', score: 5, comment: '' },
  ]

  it('calculates average for a listing', () => {
    expect(averageRating(ratings, 'l1')).toBe(3)
  })

  it('returns 0 for listing with no ratings', () => {
    expect(averageRating(ratings, 'l99')).toBe(0)
  })

  it('returns single rating when only one entry', () => {
    expect(averageRating(ratings, 'l2')).toBe(5)
  })

  it('handles multiple ratings correctly', () => {
    const multiRatings: RatingEntry[] = [
      { listingId: 'l1', rater: 'G1', score: 5, comment: '' },
      { listingId: 'l1', rater: 'G2', score: 5, comment: '' },
      { listingId: 'l1', rater: 'G3', score: 5, comment: '' },
    ]
    expect(averageRating(multiRatings, 'l1')).toBe(5)
  })

  it('rounds average correctly', () => {
    const roundRatings: RatingEntry[] = [
      { listingId: 'l1', rater: 'G1', score: 3, comment: '' },
      { listingId: 'l1', rater: 'G2', score: 4, comment: '' },
    ]
    expect(averageRating(roundRatings, 'l1')).toBe(3.5)
  })

  it('filters ratings by listing ID correctly', () => {
    const multiListingRatings: RatingEntry[] = [
      { listingId: 'l1', rater: 'G1', score: 1, comment: '' },
      { listingId: 'l2', rater: 'G2', score: 5, comment: '' },
      { listingId: 'l2', rater: 'G3', score: 5, comment: '' },
    ]
    expect(averageRating(multiListingRatings, 'l1')).toBe(1)
    expect(averageRating(multiListingRatings, 'l2')).toBe(5)
  })
})

// ── Marketplace listing operations ────────────────────────────────────────────

describe('WasteMarketplacePage — listing operations', () => {
  it('handles listings with zero weight', () => {
    const zeroWeightListing: MarketplaceListing = {
      id: 'zero',
      seller: 'GZERO',
      wasteType: WasteType.Plastic,
      weight: 0,
      pricePerKg: 0,
      description: 'empty',
      listedAt: 1000,
      rating: 0,
    }
    const result = filterListings([zeroWeightListing], '', 'all')
    expect(result).toHaveLength(1)
  })

  it('handles high price items', () => {
    const expensiveListing: MarketplaceListing = {
      id: 'expensive',
      seller: 'GRICH',
      wasteType: WasteType.Electronic,
      weight: 1,
      pricePerKg: 10000,
      description: 'premium',
      listedAt: 1000,
      rating: 5.0,
    }
    const result = sortListings([expensiveListing, listings[0]], 'price_desc')
    expect(result[0].pricePerKg).toBe(10000)
  })

  it('filters case-insensitively', () => {
    const result = filterListings(listings, 'METAL', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l2')
  })

  it('handles partial word matches in description', () => {
    const result = filterListings(listings, 'pap', 'all')
    expect(result).toHaveLength(2)
    result.forEach((r) => expect(r.description).toContain('paper'))
  })

  it('preserves all listing fields after sort', () => {
    const result = sortListings([listings[0]], 'price_asc')
    expect(result[0].seller).toBe('GABC')
    expect(result[0].description).toBe('clean paper')
    expect(result[0].rating).toBe(4.0)
  })
})

// ── Offer workflow tests ──────────────────────────────────────────────────────

describe('WasteMarketplacePage — offer workflow', () => {
  it('creates offer with timestamp', () => {
    const beforeTime = Date.now()
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    const afterTime = Date.now()
    expect(offer.createdAt).toBeGreaterThanOrEqual(beforeTime)
    expect(offer.createdAt).toBeLessThanOrEqual(afterTime)
  })

  it('tracks offer response timestamp', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    const beforeTime = Date.now()
    const updated = respondToOffer(offer, 'accepted')
    const afterTime = Date.now()
    expect(updated.respondedAt).toBeGreaterThanOrEqual(beforeTime)
    expect(updated.respondedAt).toBeLessThanOrEqual(afterTime)
  })

  it('handles offer price below list price', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 0.1)
    expect(offer.offerPrice).toBe(0.1)
  })

  it('handles offer price above list price', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 1000)
    expect(offer.offerPrice).toBe(1000)
  })

  it('tracks offer state changes', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    expect(offer.status).toBe('pending')

    const accepted = respondToOffer(offer, 'accepted')
    expect(accepted.status).toBe('accepted')

    const rejected = respondToOffer(offer, 'rejected')
    expect(rejected.status).toBe('rejected')
  })

  it('maintains buyer info after response', () => {
    const offer = makeOffer(listings[0], 'GBUYER123', 50)
    const updated = respondToOffer(offer, 'accepted')
    expect(updated.buyer).toBe('GBUYER123')
  })
})

// ── Marketplace filter combinations ───────────────────────────────────────────

describe('WasteMarketplacePage — complex filters', () => {
  it('combines multiple waste types', () => {
    const allTypes = [
      { ...listings[0], wasteType: WasteType.Paper },
      { ...listings[1], wasteType: WasteType.Metal },
      { ...listings[2], wasteType: WasteType.Glass },
    ]
    const result = filterListings(allTypes, '', WasteType.Metal)
    expect(result).toHaveLength(1)
    expect(result[0].wasteType).toBe(WasteType.Metal)
  })

  it('preserves order after multiple operations', () => {
    const sorted = sortListings(listings, 'price_asc')
    const filtered = filterListings(sorted, '', 'all')
    expect(filtered[0].pricePerKg).toBeLessThanOrEqual(filtered[1].pricePerKg)
  })

  it('handles empty listing array', () => {
    expect(filterListings([], '', 'all')).toHaveLength(0)
    expect(sortListings([], 'price_asc')).toHaveLength(0)
  })

  it('handles filters with special characters', () => {
    const specialListing: MarketplaceListing = {
      ...listings[0],
      description: 'test-paper_clean (recyclable)',
    }
    const result = filterListings([specialListing], 'test-paper', 'all')
    expect(result).toHaveLength(1)
  })
})
