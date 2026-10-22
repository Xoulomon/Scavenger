import { describe, it, expect } from 'vitest'
import { WasteType as SharedWasteType } from '@scavngr/types'
import { WasteType as ApiWasteType } from '@/api/types'
import { wasteTypeSchema, stellarAddressSchema } from './shared'

const numericValues = (enumObj: Record<string, string | number>) =>
  Object.values(enumObj).filter((v): v is number => typeof v === 'number')

describe('wasteTypeSchema', () => {
  it('accepts every waste type defined by @scavngr/types', () => {
    for (const value of numericValues(SharedWasteType)) {
      expect(wasteTypeSchema.safeParse(value).success).toBe(true)
    }
  })

  it('rejects values outside the shared enum', () => {
    const next = Math.max(...numericValues(SharedWasteType)) + 1
    expect(wasteTypeSchema.safeParse(next).success).toBe(false)
    expect(wasteTypeSchema.safeParse(-1).success).toBe(false)
    expect(wasteTypeSchema.safeParse('Paper').success).toBe(false)
  })

  it('stays in step with the WasteType the API client uses', () => {
    const shared = Object.fromEntries(
      Object.entries(SharedWasteType).filter(([, v]) => typeof v === 'number')
    )
    const api = Object.fromEntries(
      Object.entries(ApiWasteType).filter(([, v]) => typeof v === 'number')
    )
    expect(api).toEqual(shared)
  })
})

describe('stellarAddressSchema', () => {
  const valid = 'G' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.repeat(2).slice(0, 55)

  it('accepts a 56-character public key starting with G', () => {
    expect(stellarAddressSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['wrong prefix', 'S' + valid.slice(1)],
    ['too short', valid.slice(0, 55)],
    ['lowercase characters', valid.toLowerCase()],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(stellarAddressSchema.safeParse(value).success).toBe(false)
  })
})
