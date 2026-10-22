// Feature: Recycling Guide (#431)
// Tests: searchGuides, getGuideByWasteType, guide data completeness

import { describe, it, expect } from 'vitest'
import { WasteType } from '@/api/types'
import {
  searchGuides,
  getGuideByWasteType,
  RECYCLING_GUIDES,
} from './RecyclingGuidePage'

describe('RecyclingGuidePage — RECYCLING_GUIDES data', () => {
  it('has a guide for every WasteType', () => {
    const types = Object.values(WasteType).filter((v): v is WasteType => typeof v === 'number')
    types.forEach((t) => {
      expect(RECYCLING_GUIDES.some((g) => g.wasteType === t)).toBe(true)
    })
  })

  it('every guide has at least one do', () => {
    RECYCLING_GUIDES.forEach((g) => expect(g.dos.length).toBeGreaterThan(0))
  })

  it("every guide has at least one don't", () => {
    RECYCLING_GUIDES.forEach((g) => expect(g.donts.length).toBeGreaterThan(0))
  })

  it('every guide has at least one step', () => {
    RECYCLING_GUIDES.forEach((g) => expect(g.steps.length).toBeGreaterThan(0))
  })

  it('every guide has a non-empty description', () => {
    RECYCLING_GUIDES.forEach((g) => expect(g.description.length).toBeGreaterThan(0))
  })
})

describe('RecyclingGuidePage — searchGuides', () => {
  it('returns all guides for empty query', () => {
    expect(searchGuides(RECYCLING_GUIDES, '')).toHaveLength(RECYCLING_GUIDES.length)
  })

  it('returns all guides for whitespace-only query', () => {
    expect(searchGuides(RECYCLING_GUIDES, '   ')).toHaveLength(RECYCLING_GUIDES.length)
  })

  it('finds guide by waste type name', () => {
    const result = searchGuides(RECYCLING_GUIDES, 'paper')
    expect(result.some((g) => g.wasteType === WasteType.Paper)).toBe(true)
  })

  it('finds guide by content in dos', () => {
    const result = searchGuides(RECYCLING_GUIDES, 'flatten')
    expect(result.length).toBeGreaterThan(0)
  })

  it('finds guide by content in tips', () => {
    const result = searchGuides(RECYCLING_GUIDES, 'aluminium')
    expect(result.some((g) => g.wasteType === WasteType.Metal)).toBe(true)
  })

  it('returns empty array when nothing matches', () => {
    expect(searchGuides(RECYCLING_GUIDES, 'zzznomatch')).toHaveLength(0)
  })

  it('search is case-insensitive', () => {
    const lower = searchGuides(RECYCLING_GUIDES, 'metal')
    const upper = searchGuides(RECYCLING_GUIDES, 'METAL')
    expect(lower).toEqual(upper)
  })
})

describe('RecyclingGuidePage — getGuideByWasteType', () => {
  it('returns the correct guide', () => {
    const guide = getGuideByWasteType(RECYCLING_GUIDES, WasteType.Glass)
    expect(guide).toBeDefined()
    expect(guide!.wasteType).toBe(WasteType.Glass)
  })

  it('returns undefined for unknown type', () => {
    expect(getGuideByWasteType([], WasteType.Paper)).toBeUndefined()
  })
})
