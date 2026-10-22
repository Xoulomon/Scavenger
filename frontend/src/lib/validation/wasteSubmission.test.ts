import { describe, it, expect } from 'vitest'
import { WasteType } from '@scavngr/types'
import {
  wasteSubmissionSchema,
  wasteTypeFieldSchema,
  weightFieldSchema,
  latitudeFieldSchema,
  longitudeFieldSchema,
  convertWeight,
  toWeightInGrams,
} from './wasteSubmission'

const validInput = {
  wasteType: WasteType.Plastic,
  weight: '250',
  latitude: '6.5',
  longitude: '3.4',
  notes: '',
}

describe('wasteTypeFieldSchema', () => {
  it('rejects the unselected placeholder', () => {
    const result = wasteTypeFieldSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('accepts each shared waste type', () => {
    expect(wasteTypeFieldSchema.safeParse(WasteType.Metal).success).toBe(true)
  })
})

describe('weightFieldSchema', () => {
  it('rejects empty string', () => {
    expect(weightFieldSchema('grams').safeParse('').success).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    expect(weightFieldSchema('grams').safeParse('   ').success).toBe(false)
  })

  it('accepts exactly 1 gram (boundary)', () => {
    expect(weightFieldSchema('grams').safeParse('1').success).toBe(true)
  })

  it('rejects 0.9 grams (below minimum)', () => {
    expect(weightFieldSchema('grams').safeParse('0.9').success).toBe(false)
  })

  it('rejects non-numeric string', () => {
    expect(weightFieldSchema('grams').safeParse('abc').success).toBe(false)
  })

  it('accepts exactly 0.001 kg (boundary)', () => {
    expect(weightFieldSchema('kilograms').safeParse('0.001').success).toBe(true)
  })

  it('rejects 0.0009 kg (below minimum kg)', () => {
    expect(weightFieldSchema('kilograms').safeParse('0.0009').success).toBe(false)
  })
})

describe('latitudeFieldSchema', () => {
  it('rejects empty string', () => {
    expect(latitudeFieldSchema.safeParse('').success).toBe(false)
  })

  it('accepts boundary values -90 and 90', () => {
    expect(latitudeFieldSchema.safeParse('-90').success).toBe(true)
    expect(latitudeFieldSchema.safeParse('90').success).toBe(true)
  })

  it('rejects values beyond boundaries', () => {
    expect(latitudeFieldSchema.safeParse('-90.1').success).toBe(false)
    expect(latitudeFieldSchema.safeParse('90.1').success).toBe(false)
  })

  it('rejects non-numeric string', () => {
    expect(latitudeFieldSchema.safeParse('abc').success).toBe(false)
  })
})

describe('longitudeFieldSchema', () => {
  it('rejects empty string', () => {
    expect(longitudeFieldSchema.safeParse('').success).toBe(false)
  })

  it('accepts boundary values -180 and 180', () => {
    expect(longitudeFieldSchema.safeParse('-180').success).toBe(true)
    expect(longitudeFieldSchema.safeParse('180').success).toBe(true)
  })

  it('rejects values beyond boundaries', () => {
    expect(longitudeFieldSchema.safeParse('-180.1').success).toBe(false)
    expect(longitudeFieldSchema.safeParse('180.1').success).toBe(false)
  })
})

describe('wasteSubmissionSchema', () => {
  it('accepts a complete valid submission', () => {
    expect(wasteSubmissionSchema('grams').safeParse(validInput).success).toBe(true)
  })

  it('enforces the 1 gram minimum in grams', () => {
    const result = wasteSubmissionSchema('grams').safeParse({ ...validInput, weight: '0.5' })
    expect(result.success).toBe(false)
  })

  it('enforces the 0.001 kg minimum in kilograms', () => {
    const schema = wasteSubmissionSchema('kilograms')
    expect(schema.safeParse({ ...validInput, weight: '0.001' }).success).toBe(true)
    expect(schema.safeParse({ ...validInput, weight: '0.0005' }).success).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    const result = wasteSubmissionSchema().safeParse({ ...validInput, latitude: '91' })
    expect(result.success).toBe(false)
  })
})

describe('convertWeight', () => {
  it('converts grams to kilograms string', () => {
    expect(convertWeight('1000', 'grams')).toBe('1.000 kg')
  })

  it('converts kilograms to grams string', () => {
    expect(convertWeight('1.5', 'kilograms')).toBe('1500 g')
  })

  it('returns undefined for zero', () => {
    expect(convertWeight('0', 'grams')).toBeUndefined()
  })

  it('returns undefined for negative value', () => {
    expect(convertWeight('-1', 'grams')).toBeUndefined()
  })

  it('returns undefined for non-numeric string', () => {
    expect(convertWeight('abc', 'grams')).toBeUndefined()
  })
})

describe('toWeightInGrams', () => {
  it('returns the value unchanged when unit is grams', () => {
    expect(toWeightInGrams('500', 'grams')).toBe(500)
  })

  it('multiplies by 1000 when unit is kilograms', () => {
    expect(toWeightInGrams('2', 'kilograms')).toBe(2000)
  })

  it('accepts a numeric value directly', () => {
    expect(toWeightInGrams(1.5, 'kilograms')).toBe(1500)
  })
})
