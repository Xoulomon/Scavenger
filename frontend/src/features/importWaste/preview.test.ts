import { describe, it, expect } from 'vitest'
import { parseWasteCSV } from '@/lib/exportImport'

describe('parseWasteCSV - Preview', () => {
  it('generates preview for all rows including invalid ones', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
InvalidType,2300,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    expect(result.preview).toHaveLength(3)
  })

  it('includes valid status in preview rows', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
InvalidType,2300,51.5074,-0.1278`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(true)
    expect(result.preview[1].valid).toBe(false)
  })

  it('includes row numbers in preview for user reference', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Metal,2300,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].rowNumber).toBe(2)
    expect(result.preview[1].rowNumber).toBe(3)
    expect(result.preview[2].rowNumber).toBe(4)
  })

  it('includes error details in preview for debugging', () => {
    const csv = `waste_type,weight,latitude,longitude
InvalidType,abc,200,abc`
    const result = parseWasteCSV(csv)
    const preview = result.preview[0]
    expect(preview.errors).toBeDefined()
    expect(preview.errors.length).toBeGreaterThan(0)
    // Errors should be human-readable
    preview.errors.forEach((error) => {
      expect(error).toBeTruthy()
    })
  })

  it('separates data (valid only) from preview (all rows)', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
InvalidType,2300,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    // data only has valid rows
    expect(result.data).toHaveLength(2)
    // preview has all rows
    expect(result.preview).toHaveLength(3)
  })

  it('preserves original field values in preview', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500.5,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    const preview = result.preview[0]
    expect(preview.waste_type).toBe('Plastic')
    expect(preview.weight).toBe('1500.5')
    expect(preview.latitude).toBe('40.7128')
    expect(preview.longitude).toBe('-74.006')
  })

  it('provides clear error messages for validation failures', () => {
    const csv = `waste_type,weight,latitude,longitude
,1500,91,-74.006`
    const result = parseWasteCSV(csv)
    const errors = result.preview[0].errors
    expect(errors).toContain(expect.stringContaining('waste_type'))
    expect(errors).toContain(expect.stringContaining('latitude'))
  })

  it('allows users to identify which rows have issues', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Metal,invalid,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    const invalidRow = result.preview.find((r) => !r.valid)
    expect(invalidRow).toBeDefined()
    expect(invalidRow?.rowNumber).toBe(3)
    expect(invalidRow?.errors.length).toBeGreaterThan(0)
  })

  it('shows summary errors at top level', () => {
    const csv = `waste_type,weight
Plastic,1500`
    const result = parseWasteCSV(csv)
    expect(result.errors).toBeDefined()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('indicates overall import validity', () => {
    const csv1 = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Glass,800,35.6762,139.6503`
    const result1 = parseWasteCSV(csv1)
    expect(result1.valid).toBe(true)

    const csv2 = `waste_type,weight,latitude,longitude
InvalidType,1500,40.7128,-74.006`
    const result2 = parseWasteCSV(csv2)
    expect(result2.valid).toBe(false)
  })

  it('handles edge case of single row', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.preview).toHaveLength(1)
    expect(result.preview[0].rowNumber).toBe(2)
  })

  it('includes all fields in preview rows', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    const preview = result.preview[0]
    expect(preview).toHaveProperty('waste_type')
    expect(preview).toHaveProperty('weight')
    expect(preview).toHaveProperty('latitude')
    expect(preview).toHaveProperty('longitude')
    expect(preview).toHaveProperty('rowNumber')
    expect(preview).toHaveProperty('errors')
    expect(preview).toHaveProperty('valid')
  })
})
