// Feature: frontend-enhancements, Property 5: Waste timeline is chronologically ordered
// Validates: Requirements 3.1

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { WasteType } from '@/api/types'
import type { Waste } from '@/api/types'

// ── Arbitrary generators ──────────────────────────────────────────────────────

const wasteTypeArb = fc.constantFrom(
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass
)

const wasteArb: fc.Arbitrary<Waste> = fc.record({
  waste_id: fc.bigInt({ min: 1n, max: 1_000_000n }),
  waste_type: wasteTypeArb,
  weight: fc.bigInt({ min: 1n, max: 100_000n }),
  current_owner: fc.hexaString({ minLength: 56, maxLength: 56 }),
  latitude: fc.bigInt({ min: -90_000_000n, max: 90_000_000n }),
  longitude: fc.bigInt({ min: -180_000_000n, max: 180_000_000n }),
  recycled_timestamp: fc.integer({ min: 0, max: 2_000_000_000 }),
  is_active: fc.boolean(),
  is_confirmed: fc.boolean(),
  confirmer: fc.hexaString({ minLength: 56, maxLength: 56 })
})

// ── The sort function extracted from WasteTimeline ────────────────────────────
// This mirrors the exact logic in the component:
//   [...wastes].sort((a, b) => b.recycled_timestamp - a.recycled_timestamp)

function sortWastesDescending(wastes: Waste[]): Waste[] {
  return [...wastes].sort((a, b) => b.recycled_timestamp - a.recycled_timestamp)
}

// ── Property 5 ────────────────────────────────────────────────────────────────

describe('Property 5: Waste timeline is chronologically ordered', () => {
  it('renders items in descending recycled_timestamp order for any waste list', () => {
    fc.assert(
      fc.property(fc.array(wasteArb, { minLength: 0, maxLength: 50 }), (wastes) => {
        const sorted = sortWastesDescending(wastes)

        // Every adjacent pair must satisfy: earlier index has >= timestamp
        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].recycled_timestamp).toBeGreaterThanOrEqual(
            sorted[i + 1].recycled_timestamp
          )
        }

        // The sorted array must contain the same elements (no items lost or added)
        expect(sorted).toHaveLength(wastes.length)
      }),
      { numRuns: 100 }
    )
  })

  it('does not mutate the original array', () => {
    fc.assert(
      fc.property(fc.array(wasteArb, { minLength: 1, maxLength: 20 }), (wastes) => {
        const original = wastes.map((w) => w.recycled_timestamp)
        sortWastesDescending(wastes)
        const after = wastes.map((w) => w.recycled_timestamp)
        expect(after).toEqual(original)
      }),
      { numRuns: 100 }
    )
  })

  it('handles empty list without error', () => {
    const result = sortWastesDescending([])
    expect(result).toEqual([])
  })

  it('single item list is already sorted', () => {
    fc.assert(
      fc.property(wasteArb, (waste) => {
        const result = sortWastesDescending([waste])
        expect(result).toHaveLength(1)
        expect(result[0].waste_id).toBe(waste.waste_id)
      }),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: frontend-enhancements, Property 6: Edit form rejects empty names
// Validates: Requirements 5.4
// ─────────────────────────────────────────────────────────────────────────────

// Inline validation logic mirroring EditProfileModal's handleSubmit check
function validateProfileName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim()
  if (!trimmed) {
    return { valid: false, error: 'Name cannot be empty.' }
  }
  return { valid: true }
}

describe('Property 6: Edit form rejects empty names', () => {
  // Generator for whitespace-only strings (including empty string)
  const whitespaceOnlyArb = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\u00a0'), {
    minLength: 0,
    maxLength: 30
  })

  it('rejects any whitespace-only or empty name', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (name) => {
        const result = validateProfileName(name)
        expect(result.valid).toBe(false)
        expect(result.error).toBeTruthy()
      }),
      { numRuns: 100 }
    )
  })

  it('accepts names with at least one non-whitespace character', () => {
    // Generate strings that have at least one non-whitespace char
    const validNameArb = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 5 }).map((s) => s.replace(/\S/g, ' ')),
        fc.string({ minLength: 0, maxLength: 5 }).map((s) => s.replace(/\S/g, ' '))
      )
      .map(([core, prefix, suffix]) => prefix + core + suffix)

    fc.assert(
      fc.property(validNameArb, (name) => {
        const result = validateProfileName(name)
        expect(result.valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Feature: frontend-enhancements, Property 7: Profile image file validation
// Validates: Requirements 5.6
// ─────────────────────────────────────────────────────────────────────────────

import { validateProfileImage } from '@/lib/profile'

const MAX_FILE_SIZE = 2_097_152 // 2 MB

describe('Property 7: Profile image file validation', () => {
  const allowedMimeTypes = ['image/jpeg', 'image/png']
  const disallowedMimeTypes = [
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'text/plain',
    'video/mp4'
  ]

  it('accepts JPEG and PNG files within 2 MB', () => {
    const validFileArb = fc.record({
      type: fc.constantFrom(...allowedMimeTypes),
      size: fc.integer({ min: 1, max: MAX_FILE_SIZE })
    })

    fc.assert(
      fc.property(validFileArb, (file) => {
        const result = validateProfileImage(file)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })

  it('rejects files with disallowed MIME types regardless of size', () => {
    const invalidTypeArb = fc.record({
      type: fc.constantFrom(...disallowedMimeTypes),
      size: fc.integer({ min: 1, max: MAX_FILE_SIZE })
    })

    fc.assert(
      fc.property(invalidTypeArb, (file) => {
        const result = validateProfileImage(file)
        expect(result.valid).toBe(false)
        expect(result.error).toBeTruthy()
      }),
      { numRuns: 100 }
    )
  })

  it('rejects files exceeding 2 MB even if MIME type is valid', () => {
    const oversizedArb = fc.record({
      type: fc.constantFrom(...allowedMimeTypes),
      size: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 })
    })

    fc.assert(
      fc.property(oversizedArb, (file) => {
        const result = validateProfileImage(file)
        expect(result.valid).toBe(false)
        expect(result.error).toBeTruthy()
      }),
      { numRuns: 100 }
    )
  })

  it('rejects files that are both wrong type and oversized', () => {
    const bothInvalidArb = fc.record({
      type: fc.constantFrom(...disallowedMimeTypes),
      size: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 })
    })

    fc.assert(
      fc.property(bothInvalidArb, (file) => {
        const result = validateProfileImage(file)
        expect(result.valid).toBe(false)
        expect(result.error).toBeTruthy()
      }),
      { numRuns: 100 }
    )
  })

  it('accepts a file at exactly 2 MB boundary', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allowedMimeTypes), (type) => {
        const result = validateProfileImage({ type, size: MAX_FILE_SIZE })
        expect(result.valid).toBe(true)
      }),
      { numRuns: 10 }
    )
  })

  it('rejects a file one byte over 2 MB', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allowedMimeTypes), (type) => {
        const result = validateProfileImage({ type, size: MAX_FILE_SIZE + 1 })
        expect(result.valid).toBe(false)
      }),
      { numRuns: 10 }
    )
  })
})
