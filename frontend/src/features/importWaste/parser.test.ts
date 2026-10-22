import { describe, it, expect } from 'vitest'
import { parseWasteCSV } from '@/lib/exportImport'

describe('parseWasteCSV - Parser', () => {
  it('parses valid CSV with all required columns', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].waste_type).toBe('Plastic')
    expect(result.data[0].weight).toBe('1500')
    expect(result.data[0].latitude).toBe('40.7128')
    expect(result.data[0].longitude).toBe('-74.006')
  })

  it('handles multiple rows', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Metal,2300,51.5074,-0.1278
Glass,800,35.6762,139.6503`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(3)
    expect(result.preview).toHaveLength(3)
  })

  it('detects missing required columns', () => {
    const csv = `waste_type,weight
Plastic,1500`
    const result = parseWasteCSV(csv)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.valid).toBe(false)
  })

  it('handles extra columns gracefully', () => {
    const csv = `waste_type,weight,latitude,longitude,extra_field
Plastic,1500,40.7128,-74.006,ignored`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(1)
    expect(result.valid).toBe(true)
  })

  it('parses case-insensitive headers', () => {
    const csv = `Waste_Type,Weight,Latitude,Longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(1)
  })

  it('handles whitespace in headers', () => {
    const csv = ` waste_type , weight , latitude , longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(1)
  })

  it('skips empty lines', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006

Metal,2300,51.5074,-0.1278

`
    const result = parseWasteCSV(csv)
    expect(result.data).toHaveLength(2)
    expect(result.preview).toHaveLength(2)
  })

  it('includes row numbers in preview (1-based with header)', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Metal,2300,51.5074,-0.1278`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].rowNumber).toBe(2)
    expect(result.preview[1].rowNumber).toBe(3)
  })

  it('preserves original data in preview', () => {
    const csv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006`
    const result = parseWasteCSV(csv)
    const preview = result.preview[0]
    expect(preview.waste_type).toBe('Plastic')
    expect(preview.weight).toBe('1500')
    expect(preview.latitude).toBe('40.7128')
    expect(preview.longitude).toBe('-74.006')
  })
})
