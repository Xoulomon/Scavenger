import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportWasteToCSV,
  exportWasteToJSON,
  exportAnalyticsToCSV,
  parseWasteCSV,
  generateWasteTemplateCSV,
  triggerDownload,
  PDFExporter,
  type AnalyticsMonthlyRow,
} from './exportImport'
import { WasteType, Role } from '@/api/types'
import type { Waste, Participant, ParticipantStats } from '@/api/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockWaste: Waste = {
  waste_id: 1n,
  waste_type: WasteType.Plastic,
  weight: 1500n,
  current_owner: 'GABC1234',
  latitude: 40n,
  longitude: -74n,
  recycled_timestamp: 1_700_000_000,
  is_active: true,
  is_confirmed: true,
  confirmer: 'GDEF5678',
}

const mockParticipant: Participant = {
  address: 'GABC1234',
  role: Role.Recycler,
  name: 'Alice',
  latitude: 40,
  longitude: -74,
  registered_at: 1_680_000_000,
}

const mockStats: ParticipantStats = {
  address: 'GABC1234',
  total_earned: 5000n,
  materials_submitted: 10,
  transfers_count: 3,
}

const mockMonthlyData: AnalyticsMonthlyRow[] = [
  { month: 'Jan', plastic: 45, metal: 30, glass: 25 },
  { month: 'Feb', plastic: 52, metal: 35, glass: 28 },
]

// ── CSV export ─────────────────────────────────────────────────────────────────

describe('exportWasteToCSV', () => {
  it('returns a Blob with text/csv MIME type', () => {
    const blob = exportWasteToCSV([mockWaste])
    expect(blob.type).toBe('text/csv;charset=utf-8;')
  })

  it('includes all required CSV headers', async () => {
    const blob = exportWasteToCSV([mockWaste])
    const text = await blob.text()
    const headers = text.split('\n')[0]
    expect(headers).toContain('waste_id')
    expect(headers).toContain('waste_type')
    expect(headers).toContain('weight')
    expect(headers).toContain('current_owner')
  })

  it('serialises waste data correctly', async () => {
    const blob = exportWasteToCSV([mockWaste])
    const text = await blob.text()
    const dataRow = text.split('\n')[1]
    expect(dataRow).toContain('1') // waste_id
    expect(dataRow).toContain('Plastic') // waste_type label
    expect(dataRow).toContain('1500') // weight
    expect(dataRow).toContain('GABC1234') // owner
  })

  it('produces a header-only blob when given an empty array', async () => {
    const blob = exportWasteToCSV([])
    const text = await blob.text()
    expect(text.split('\n')).toHaveLength(1) // header row only
  })

  it('escapes cells containing commas', async () => {
    const waste = { ...mockWaste, confirmer: 'FIRST,SECOND' }
    const blob = exportWasteToCSV([waste])
    const text = await blob.text()
    expect(text).toContain('"FIRST,SECOND"')
  })
})

// ── JSON export ────────────────────────────────────────────────────────────────

describe('exportWasteToJSON', () => {
  it('returns a Blob with application/json MIME type', () => {
    const blob = exportWasteToJSON([mockWaste])
    expect(blob.type).toBe('application/json')
  })

  it('serialises to valid JSON with correct fields', async () => {
    const blob = exportWasteToJSON([mockWaste])
    const json = JSON.parse(await blob.text())
    expect(Array.isArray(json)).toBe(true)
    expect(json[0]).toMatchObject({
      waste_id: '1',
      waste_type: 'Plastic',
      weight: '1500',
      current_owner: 'GABC1234',
    })
  })
})

// ── Analytics CSV export ──────────────────────────────────────────────────────

describe('exportAnalyticsToCSV', () => {
  it('returns a text/csv Blob', () => {
    const blob = exportAnalyticsToCSV(mockMonthlyData)
    expect(blob.type).toBe('text/csv;charset=utf-8;')
  })

  it('includes monthly headers', async () => {
    const blob = exportAnalyticsToCSV(mockMonthlyData)
    const text = await blob.text()
    expect(text).toContain('Month')
    expect(text).toContain('Plastic (%)')
    expect(text).toContain('Metal (%)')
    expect(text).toContain('Glass (%)')
  })

  it('includes data rows for each month', async () => {
    const blob = exportAnalyticsToCSV(mockMonthlyData)
    const text = await blob.text()
    expect(text).toContain('Jan')
    expect(text).toContain('Feb')
  })
})

// ── CSV import / parseWasteCSV ────────────────────────────────────────────────

describe('parseWasteCSV', () => {
  const validCsv = `waste_type,weight,latitude,longitude
Plastic,1500,40.7128,-74.006
Metal,2300,51.5074,-0.1278`

  it('parses a valid CSV successfully', () => {
    const result = parseWasteCSV(validCsv)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data).toHaveLength(2)
  })

  it('flags missing required columns', () => {
    const csv = `waste_type,weight\nPlastic,1500`
    const result = parseWasteCSV(csv)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('latitude'))).toBe(true)
  })

  it('flags invalid waste type', () => {
    const csv = `waste_type,weight,latitude,longitude\nUnknownType,500,10,20`
    const result = parseWasteCSV(csv)
    expect(result.valid).toBe(false)
    expect(result.preview[0].valid).toBe(false)
    expect(result.preview[0].errors[0]).toContain('Invalid waste_type')
  })

  it('flags non-positive weight', () => {
    const csv = `waste_type,weight,latitude,longitude\nPlastic,-5,10,20`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors.some((e) => e.includes('weight'))).toBe(true)
  })

  it('flags out-of-range latitude', () => {
    const csv = `waste_type,weight,latitude,longitude\nPlastic,100,100,20`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors.some((e) => e.includes('latitude'))).toBe(true)
  })

  it('flags out-of-range longitude', () => {
    const csv = `waste_type,weight,latitude,longitude\nPlastic,100,10,200`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors.some((e) => e.includes('longitude'))).toBe(true)
  })

  it('attaches correct rowNumber to preview rows', () => {
    const result = parseWasteCSV(validCsv)
    expect(result.preview[0].rowNumber).toBe(2)
    expect(result.preview[1].rowNumber).toBe(3)
  })
})

// ── Template CSV ──────────────────────────────────────────────────────────────

describe('generateWasteTemplateCSV', () => {
  it('includes headers and example rows', () => {
    const csv = generateWasteTemplateCSV()
    const lines = csv.split('\n')
    expect(lines[0]).toBe('waste_type,weight,latitude,longitude')
    expect(lines.length).toBeGreaterThan(1)
  })
})

// ── triggerDownload ───────────────────────────────────────────────────────────

describe('triggerDownload', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let appendChildSpy: ReturnType<typeof vi.fn>
  let removeChildSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    appendChildSpy = vi.fn()
    removeChildSpy = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    document.body.appendChild = appendChildSpy
    document.body.removeChild = removeChildSpy
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates an object URL and revokes it after download', () => {
    const blob = new Blob(['test'], { type: 'text/plain' })
    triggerDownload(blob, 'test.txt')
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('appends and removes an anchor element', () => {
    const blob = new Blob(['test'], { type: 'text/plain' })
    triggerDownload(blob, 'test.txt')
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
  })
})

// ── PDFExporter ───────────────────────────────────────────────────────────────

describe('PDFExporter', () => {
  it('constructs without errors', () => {
    expect(() => new PDFExporter()).not.toThrow()
  })

  it('getBlob returns a Blob after exportWasteData', () => {
    const exporter = new PDFExporter()
    exporter.exportWasteData([
      {
        id: '1',
        type: 'Plastic',
        weight: 1.5,
        status: 'active',
        date: new Date(),
        verificationStatus: 'verified',
      },
    ])
    const blob = exporter.getBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('getBlob returns a Blob after exportAnalytics', () => {
    const exporter = new PDFExporter()
    exporter.exportAnalytics({
      totalWaste: 10,
      wasteByType: { Plastic: 5, Metal: 5 },
      verificationRate: 0.8,
      averageWeight: 1.2,
    })
    const blob = exporter.getBlob()
    expect(blob).toBeInstanceOf(Blob)
  })

  it('getBlob returns a Blob after exportAnalyticsMonthly', () => {
    const exporter = new PDFExporter()
    exporter.exportAnalyticsMonthly(mockMonthlyData)
    const blob = exporter.getBlob()
    expect(blob).toBeInstanceOf(Blob)
  })

  it('exportParticipantStatsToPDF produces a non-empty Blob', async () => {
    // Dynamic import to avoid circular dep issues in test isolation
    const { exportParticipantStatsToPDF } = await import('./exportImport')
    const blob = exportParticipantStatsToPDF(mockParticipant, mockStats)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
