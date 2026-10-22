import { describe, it, expect } from 'vitest'
import { parseWasteCSV } from '@/lib/exportImport'

describe('parseWasteCSV - Validator', () => {
  it('validates waste_type is required', () => {
    const csv = `waste_type,weight,latitude,longitude
,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors).toContain(expect.stringContaining('waste_type is required'))
  })

  it('validates waste_type is valid', () => {
    const csv = `waste_type,weight,latitude,longitude
InvalidType,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors.length).toBeGreaterThan(0)
    expect(result.preview[0].errors[0]).toContain('Invalid waste_type')
  })

  it('accepts valid waste types', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Metal,2300,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    result.preview.forEach((row) => {
      expect(row.errors.filter((e) => e.includes('waste_type'))).toHaveLength(0)
    })
  })

  it('validates weight is required and positive', () => {
    const csv1 = `waste_type,weight,latitude,longitude
Plastic,,40.7128,-74.006`
    const result1 = parseWasteCSV(csv1)
    expect(result1.preview[0].errors).toContain(expect.stringContaining('weight'))

    const csv2 = `waste_type,weight,latitude,longitude
Plastic,-100,40.7128,-74.006`
    const result2 = parseWasteCSV(csv2)
    expect(result2.preview[0].errors).toContain(expect.stringContaining('weight'))
  })

  it('validates weight is numeric', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,abc,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors).toContain(expect.stringContaining('weight'))
  })

  it('validates latitude range', () => {
    const csv1 = `waste_type,weight,latitude,longitude
Plastic,1500,91,0`
    const result1 = parseWasteCSV(csv1)
    expect(result1.preview[0].errors).toContain(expect.stringContaining('latitude'))

    const csv2 = `waste_type,weight,latitude,longitude
Plastic,1500,-91,0`
    const result2 = parseWasteCSV(csv2)
    expect(result2.preview[0].errors).toContain(expect.stringContaining('latitude'))
  })

  it('accepts valid latitude values', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,0,0
Metal,2300,90,-180
Glass,800,-90,180`
    const result = parseWasteCSV(csv)
    result.preview.forEach((row) => {
      expect(row.errors.filter((e) => e.includes('latitude'))).toHaveLength(0)
    })
  })

  it('validates longitude range', () => {
    const csv1 = `waste_type,weight,latitude,longitude
Plastic,1500,0,181`
    const result1 = parseWasteCSV(csv1)
    expect(result1.preview[0].errors).toContain(expect.stringContaining('longitude'))

    const csv2 = `waste_type,weight,latitude,longitude
Plastic,1500,0,-181`
    const result2 = parseWasteCSV(csv2)
    expect(result2.preview[0].errors).toContain(expect.stringContaining('longitude'))
  })

  it('validates latitude and longitude are numeric', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,abc,xyz`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors.length).toBeGreaterThan(0)
  })

  it('marks row as valid when all fields pass validation', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(true)
    expect(result.preview[0].errors).toHaveLength(0)
  })

  it('marks row as invalid when any field fails validation', () => {
    const csv = `waste_type,weight,latitude,longitude
InvalidType,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
    expect(result.preview[0].errors.length).toBeGreaterThan(0)
  })

  it('separates valid and invalid rows', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
InvalidType,2300,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(2) // Only valid rows
    expect(result.preview).toHaveLength(3) // All rows shown
    expect(result.preview[0].valid).toBe(true)
    expect(result.preview[1].valid).toBe(false)
    expect(result.preview[2].valid).toBe(true)
  })

  it('preserves validation errors in preview', () => {
    const csv = `waste_type,weight,latitude,longitude
,abc,200,abc`
    const result = parseWasteCSV(csv)
    const errors = result.preview[0].errors
    expect(errors.length).toBeGreaterThan(0)
  })

  it('sets overall valid flag correctly', () => {
    const csv1 = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006`
    const result1 = parseWasteCSV(csv1)
    expect(result1.valid).toBe(true)

    const csv2 = `waste_type,weight,latitude,longitude
InvalidType,1500,40.7128,-74.006`
    const result2 = parseWasteCSV(csv2)
    expect(result2.valid).toBe(false)
  })
})
