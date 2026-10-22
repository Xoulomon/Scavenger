import { describe, it, expect } from 'vitest'
import {
  filterListings,
  sortListings,
  makeOffer,
  respondToOffer,
  averageRating,
  type MarketplaceListing,
  type RatingEntry,
} from '@/pages/WasteMarketplacePage'
import { sortIncentives, filterIncentives } from '@/lib/incentivesUtils'
import { WasteType } from '@/api/types'
import type { Incentive } from '@/api/types'

const listings: MarketplaceListing[] = [
  { id: 'l1', seller: 'Acme Recycling', wasteType: WasteType.Plastic, weight: 10, pricePerKg: 2, description: 'Clean bottles', listedAt: 1, rating: 4 },
  { id: 'l2', seller: 'Green Co', wasteType: WasteType.Metal, weight: 50, pricePerKg: 5, description: 'Scrap aluminium', listedAt: 2, rating: 5 },
  { id: 'l3', seller: 'Bottle Barn', wasteType: WasteType.Plastic, weight: 25, pricePerKg: 1, description: 'Mixed PET', listedAt: 3, rating: 3 },
]

const incentives: Incentive[] = [
  { id: 1, rewarder: 'City Council', waste_type: WasteType.Paper, reward_points: 30, total_budget: 100, remaining_budget: 40, active: true, created_at: 1 },
  { id: 2, rewarder: 'Metro Recycle', waste_type: WasteType.Metal, reward_points: 10, total_budget: 100, remaining_budget: 90, active: true, created_at: 2 },
  { id: 3, rewarder: 'city Parks', waste_type: WasteType.Plastic, reward_points: 20, total_budget: 100, remaining_budget: 10, active: false, created_at: 3 },
]

const noFilters = { wasteTypes: [], rewarder: '' }

describe('marketplace listing helpers (WasteMarketplacePage)', () => {
  it('returns every listing when type is "all" and query is empty', () => {
    expect(filterListings(listings, '', 'all')).toHaveLength(3)
  })

  it('keeps only listings of the requested waste type', () => {
    const result = filterListings(listings, '', WasteType.Plastic)
    expect(result.map((l) => l.id)).toEqual(['l1', 'l3'])
  })

  it('matches the query against seller and description, case-insensitively', () => {
    expect(filterListings(listings, 'GREEN', 'all').map((l) => l.id)).toEqual(['l2'])
    expect(filterListings(listings, 'pet', 'all').map((l) => l.id)).toEqual(['l3'])
  })

  it('does not mutate the input array when filtering', () => {
    const copy = [...listings]
    filterListings(listings, 'bottle', 'all')
    expect(listings).toEqual(copy)
  })

  it('sorts by price ascending and descending', () => {
    expect(sortListings(listings, 'price_asc').map((l) => l.id)).toEqual(['l3', 'l1', 'l2'])
    expect(sortListings(listings, 'price_desc').map((l) => l.id)).toEqual(['l2', 'l1', 'l3'])
  })

  it('sorts by weight and rating, largest first', () => {
    expect(sortListings(listings, 'weight').map((l) => l.id)).toEqual(['l2', 'l3', 'l1'])
    expect(sortListings(listings, 'rating').map((l) => l.id)).toEqual(['l2', 'l1', 'l3'])
  })

  it('does not mutate the input array when sorting', () => {
    const before = listings.map((l) => l.id)
    sortListings(listings, 'price_desc')
    expect(listings.map((l) => l.id)).toEqual(before)
  })

  it('creates a pending offer carrying the buyer and price', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 1.5)
    expect(offer).toMatchObject({ listingId: 'l1', buyer: 'GBUYER', offerPrice: 1.5, status: 'pending' })
  })

  it('records an accept or reject decision on an offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 1.5)
    expect(respondToOffer(offer, 'accepted').status).toBe('accepted')
    expect(respondToOffer(offer, 'rejected').status).toBe('rejected')
    expect(offer.status).toBe('pending')
  })

  it('averages only the ratings for the requested listing', () => {
    const ratings: RatingEntry[] = [
      { listingId: 'l1', rater: 'a', score: 4, comment: '' },
      { listingId: 'l1', rater: 'b', score: 2, comment: '' },
      { listingId: 'l2', rater: 'c', score: 5, comment: '' },
    ]
    expect(averageRating(ratings, 'l1')).toBe(3)
  })

  it('returns 0 when a listing has no ratings', () => {
    expect(averageRating([], 'l1')).toBe(0)
  })
})

describe('marketplace listing helpers shared with incentives (incentivesUtils)', () => {
  it('returns every incentive when no filter is set', () => {
    expect(filterIncentives(incentives, noFilters)).toHaveLength(3)
  })

  it('keeps only incentives whose waste type is selected', () => {
    const result = filterIncentives(incentives, { wasteTypes: [WasteType.Metal], rewarder: '' })
    expect(result.map((i) => i.id)).toEqual([2])
  })

  it('matches the rewarder substring case-insensitively', () => {
    const result = filterIncentives(incentives, { wasteTypes: [], rewarder: 'CITY' })
    expect(result.map((i) => i.id)).toEqual([1, 3])
  })

  it('sorts by reward points in both directions without mutating input', () => {
    const before = incentives.map((i) => i.id)
    expect(sortIncentives(incentives, 'reward_points', 'asc').map((i) => i.id)).toEqual([2, 3, 1])
    expect(sortIncentives(incentives, 'reward_points', 'desc').map((i) => i.id)).toEqual([1, 3, 2])
    expect(incentives.map((i) => i.id)).toEqual(before)
  })

  it('sorts by remaining budget', () => {
    expect(sortIncentives(incentives, 'remaining_budget', 'desc').map((i) => i.id)).toEqual([2, 1, 3])
  })
})
