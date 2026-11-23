/**
 * Export/Import Utility Unit Tests (#942)
 *
 * Comprehensive coverage for frontend/src/lib/exportImport.ts:
 *  - CSV export (waste, analytics)
 *  - JSON export (waste)
 *  - PDF export (participant stats, PDFExporter class)
 *  - CSV import / parsing (valid, malformed, edge cases)
 *  - Template generation
 *  - triggerDownload helper
 *  - Performance: large dataset fixtures (≥ 1000 rows)
 *
 * Target coverage: ≥ 90% for exportImport.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportWasteToCSV,
  exportWasteToJSON,
  exportAnalyticsToCSV,
  exportParticipantStatsToPDF,
  PDFExporter,
  parseWasteCSV,
  generateWasteTemplateCSV,
  triggerDownload,
  type AnalyticsMonthlyRow,
  type WasteExportData,
  type PDFExportOptions
} from '../../src/lib/exportImport'
import { WasteType } from '../../src/api/types'
import type { Waste, Participant, ParticipantStats } from '../../src/api/types'

// ─── Mock jsPDF ──────────────────────────────────────────────────────────────
const mockText = vi.fn()
const mockLine = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetTextColor = vi.fn()
const mockSetDrawColor = vi.fn()
const mockSetPage = vi.fn()
const mockOutput = vi.fn(() => new Blob(['%PDF'], { type: 'application/pdf' }))
const mockSave = vi.fn()
const mockAutoTable = vi.fn()
const mockGetNumberOfPages = vi.fn(() => 1)
const mockGetPageWidth = vi.fn(() => 210)
const mockGetPageHeight = vi.fn(() => 297)

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    text: mockText,
    line: mockLine,
    setFontSize: mockSetFontSize,
    setTextColor: mockSetTextColor,
    setDrawColor: mockSetDrawColor,
    setPage: mockSetPage,
    output: mockOutput,
    save: mockSave,
    autoTable: mockAutoTable,
    getNumberOfPages: mockGetNumberOfPages,
    internal: {
      pageSize: {
        getWidth: mockGetPageWidth,
        getHeight: mockGetPageHeight
      }
    }
  }))
}))

// ─── Mock papaparse ──────────────────────────────────────────────────────────
vi.mock('papaparse', async () => {
  const actual = await vi.importActual<typeof import('papaparse')>('papaparse')
  return actual
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeWaste(overrides: Partial<Waste> = {}): Waste {
  return {
    waste_id: 1,
    waste_type: WasteType.Plastic,
    weight: 1000,
    current_owner: 'GOWNER001',
    latitude: 40712800,
    longitude: -74006000,
    recycled_timestamp: 1700000000,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
    ...overrides
  }
}

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    address: 'GPART001',
    name: 'Alice',
    role: 0,
    latitude: 40712800,
    longitude: -74006000,
    registered_at: 1700000000,
    is_active: true,
    ...overrides
  }
}

function makeStats(overrides: Partial<ParticipantStats> = {}): ParticipantStats {
  return {
    total_earned: BigInt(5000),
    materials_submitted: 10,
    transfers_count: 3,
    ...overrides
  }
}

function makeAnalyticsRow(
  month = 'Jan',
  overrides: Partial<AnalyticsMonthlyRow> = {}
): AnalyticsMonthlyRow {
  return { month, plastic: 40, metal: 35, glass: 25, ...overrides }
}

function makeWasteExportData(overrides: Partial<WasteExportData> = {}): WasteExportData {
  return {
    id: '1',
    type: 'Plastic',
    weight: 5.5,
    status: 'active',
    date: new Date('2024-01-01'),
    verificationStatus: 'verified',
    notes: 'test',
    ...overrides
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

async function blobToJson(blob: Blob): Promise<unknown> {
  const text = await blobToText(blob)
  return JSON.parse(text)
}

// ═══════════════════════════════════════════════════════════════════════════
//  exportWasteToCSV
// ═══════════════════════════════════════════════════════════════════════════

describe('exportWasteToCSV', () => {
  it('returns a Blob with text/csv mime type', () => {
    const blob = exportWasteToCSV([makeWaste()])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toContain('text/csv')
  })

  it('first row is the header row', async () => {
    const blob = exportWasteToCSV([makeWaste()])
    const text = await blobToText(blob)
    const firstLine = text.split('\n')[0]
    expect(firstLine).toContain('waste_id')
    expect(firstLine).toContain('waste_type')
    expect(firstLine).toContain('weight')
    expect(firstLine).toContain('current_owner')
    expect(firstLine).toContain('latitude')
    expect(firstLine).toContain('longitude')
    expect(firstLine).toContain('recycled_timestamp')
    expect(firstLine).toContain('is_active')
    expect(firstLine).toContain('is_confirmed')
  })

  it('exports the correct number of data rows', async () => {
    const wastes = [
      makeWaste({ waste_id: 1 }),
      makeWaste({ waste_id: 2 }),
      makeWaste({ waste_id: 3 })
    ]
    const blob = exportWasteToCSV(wastes)
    const text = await blobToText(blob)
    const lines = text.split('\n').filter(Boolean)
    // header + 3 rows
    expect(lines.length).toBe(4)
  })

  it('data row contains waste_id value', async () => {
    const blob = exportWasteToCSV([makeWaste({ waste_id: 42 })])
    const text = await blobToText(blob)
    expect(text).toContain('42')
  })

  it('maps WasteType enum to human-readable string', async () => {
    const blob = exportWasteToCSV([makeWaste({ waste_type: WasteType.Metal })])
    const text = await blobToText(blob)
    expect(text).toContain('Metal')
  })

  it('formats recycled_timestamp as ISO string', async () => {
    const blob = exportWasteToCSV([makeWaste({ recycled_timestamp: 1700000000 })])
    const text = await blobToText(blob)
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('serialises booleans as "true"/"false" strings', async () => {
    const blob = exportWasteToCSV([makeWaste({ is_active: true, is_confirmed: false })])
    const text = await blobToText(blob)
    expect(text).toContain('true')
    expect(text).toContain('false')
  })

  it('escapes cells that contain commas', async () => {
    const blob = exportWasteToCSV([makeWaste({ current_owner: 'A,B' })])
    const text = await blobToText(blob)
    expect(text).toContain('"A,B"')
  })

  it('escapes cells that contain double-quotes', async () => {
    const blob = exportWasteToCSV([makeWaste({ current_owner: 'say "hi"' })])
    const text = await blobToText(blob)
    expect(text).toContain('"say ""hi"""')
  })

  it('handles empty waste array — outputs only header row', async () => {
    const blob = exportWasteToCSV([])
    const text = await blobToText(blob)
    const lines = text.split('\n').filter(Boolean)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('waste_id')
  })

  it('handles all WasteType variants without throwing', () => {
    const types = [
      WasteType.Plastic,
      WasteType.Metal,
      WasteType.Glass,
      WasteType.Paper,
      WasteType.Organic,
      WasteType.Electronic
    ]
    expect(() =>
      exportWasteToCSV(types.map((t, i) => makeWaste({ waste_id: i, waste_type: t })))
    ).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  exportWasteToJSON
// ═══════════════════════════════════════════════════════════════════════════

describe('exportWasteToJSON', () => {
  it('returns a Blob with application/json mime type', () => {
    const blob = exportWasteToJSON([makeWaste()])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toContain('application/json')
  })

  it('blob content is valid JSON', async () => {
    const blob = exportWasteToJSON([makeWaste()])
    await expect(blobToJson(blob)).resolves.not.toThrow()
  })

  it('exported array length matches input', async () => {
    const blob = exportWasteToJSON([makeWaste({ waste_id: 1 }), makeWaste({ waste_id: 2 })])
    const data = (await blobToJson(blob)) as unknown[]
    expect(data.length).toBe(2)
  })

  it('each object contains expected fields', async () => {
    const blob = exportWasteToJSON([makeWaste()])
    const data = (await blobToJson(blob)) as Record<string, unknown>[]
    const first = data[0]
    expect(first).toHaveProperty('waste_id')
    expect(first).toHaveProperty('waste_type')
    expect(first).toHaveProperty('weight')
    expect(first).toHaveProperty('current_owner')
    expect(first).toHaveProperty('latitude')
    expect(first).toHaveProperty('longitude')
    expect(first).toHaveProperty('recycled_timestamp')
    expect(first).toHaveProperty('is_active')
    expect(first).toHaveProperty('is_confirmed')
  })

  it('waste_type is serialised as human-readable string', async () => {
    const blob = exportWasteToJSON([makeWaste({ waste_type: WasteType.Glass })])
    const data = (await blobToJson(blob)) as Record<string, unknown>[]
    expect(data[0].waste_type).toBe('Glass')
  })

  it('handles empty array — produces valid empty JSON array', async () => {
    const blob = exportWasteToJSON([])
    const data = await blobToJson(blob)
    expect(data).toEqual([])
  })

  it('output is formatted JSON (contains newlines)', async () => {
    const blob = exportWasteToJSON([makeWaste()])
    const text = await blobToText(blob)
    expect(text).toContain('\n')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  exportAnalyticsToCSV
// ═══════════════════════════════════════════════════════════════════════════

describe('exportAnalyticsToCSV', () => {
  it('returns a Blob with text/csv mime type', () => {
    const blob = exportAnalyticsToCSV([makeAnalyticsRow()])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toContain('text/csv')
  })

  it('first row contains analytics header columns', async () => {
    const blob = exportAnalyticsToCSV([makeAnalyticsRow()])
    const text = await blobToText(blob)
    const header = text.split('\n')[0]
    expect(header).toContain('Month')
    expect(header).toContain('Plastic')
    expect(header).toContain('Metal')
    expect(header).toContain('Glass')
  })

  it('data rows match the input', async () => {
    const rows = [
      makeAnalyticsRow('Jan', { plastic: 40, metal: 30, glass: 30 }),
      makeAnalyticsRow('Feb', { plastic: 50, metal: 25, glass: 25 })
    ]
    const blob = exportAnalyticsToCSV(rows)
    const text = await blobToText(blob)
    expect(text).toContain('Jan')
    expect(text).toContain('Feb')
    expect(text).toContain('40')
    expect(text).toContain('50')
  })

  it('handles empty array — outputs only header', async () => {
    const blob = exportAnalyticsToCSV([])
    const text = await blobToText(blob)
    const lines = text.split('\n').filter(Boolean)
    expect(lines.length).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  exportParticipantStatsToPDF
// ═══════════════════════════════════════════════════════════════════════════

describe('exportParticipantStatsToPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOutput.mockReturnValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    mockGetNumberOfPages.mockReturnValue(1)
    mockGetPageWidth.mockReturnValue(210)
    mockGetPageHeight.mockReturnValue(297)
  })

  it('returns a Blob', () => {
    const blob = exportParticipantStatsToPDF(makeParticipant(), makeStats())
    expect(blob).toBeInstanceOf(Blob)
  })

  it('calls jsPDF text() with participant name', () => {
    exportParticipantStatsToPDF(makeParticipant({ name: 'Bob' }), makeStats())
    const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
    expect(allTextArgs.some((t) => t.includes('Bob'))).toBe(true)
  })

  it('calls jsPDF text() with participant address', () => {
    exportParticipantStatsToPDF(makeParticipant({ address: 'GTEST' }), makeStats())
    const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
    expect(allTextArgs.some((t) => t.includes('GTEST'))).toBe(true)
  })

  it('includes stats data in the PDF', () => {
    exportParticipantStatsToPDF(makeParticipant(), makeStats({ materials_submitted: 99 }))
    const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
    expect(allTextArgs.some((t) => t.includes('99'))).toBe(true)
  })

  it('does not throw for a participant with empty confirmer', () => {
    expect(() => exportParticipantStatsToPDF(makeParticipant(), makeStats())).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  PDFExporter class
// ═══════════════════════════════════════════════════════════════════════════

describe('PDFExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOutput.mockReturnValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    mockGetNumberOfPages.mockReturnValue(1)
    mockGetPageWidth.mockReturnValue(210)
    mockGetPageHeight.mockReturnValue(297)
  })

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      expect(() => new PDFExporter()).not.toThrow()
    })

    it('creates an instance with landscape orientation', () => {
      expect(() => new PDFExporter({ orientation: 'landscape' })).not.toThrow()
    })

    it('creates an instance with letter format', () => {
      expect(() => new PDFExporter({ format: 'letter' })).not.toThrow()
    })
  })

  describe('exportWasteData()', () => {
    it('returns a jsPDF doc object', () => {
      const exporter = new PDFExporter()
      const doc = exporter.exportWasteData([makeWasteExportData()])
      expect(doc).toBeDefined()
    })

    it('calls autoTable with waste data rows', () => {
      const exporter = new PDFExporter()
      exporter.exportWasteData([makeWasteExportData()])
      expect(mockAutoTable).toHaveBeenCalled()
    })

    it('adds header title text to doc', () => {
      const exporter = new PDFExporter({ title: 'My Waste Report' })
      exporter.exportWasteData([], { title: 'My Waste Report' })
      const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
      expect(allTextArgs.some((t) => t.includes('My Waste Report'))).toBe(true)
    })

    it('includes metadata summary when includeMetadata is true', () => {
      const exporter = new PDFExporter()
      exporter.exportWasteData([makeWasteExportData({ weight: 42.0 })], { includeMetadata: true })
      const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
      expect(allTextArgs.some((t) => t.includes('Total Items'))).toBe(true)
    })

    it('counts verified items in metadata', () => {
      const exporter = new PDFExporter()
      const items = [
        makeWasteExportData({ verificationStatus: 'verified' }),
        makeWasteExportData({ verificationStatus: 'pending' })
      ]
      exporter.exportWasteData(items, { includeMetadata: true })
      const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
      expect(allTextArgs.some((t) => t.includes('Verified Items: 1'))).toBe(true)
    })

    it('handles empty waste list without throwing', () => {
      const exporter = new PDFExporter()
      expect(() => exporter.exportWasteData([])).not.toThrow()
    })

    it('adds footer pages', () => {
      mockGetNumberOfPages.mockReturnValue(3)
      const exporter = new PDFExporter()
      exporter.exportWasteData([makeWasteExportData()])
      expect(mockSetPage).toHaveBeenCalled()
    })
  })

  describe('exportAnalytics()', () => {
    it('returns a jsPDF doc object', () => {
      const exporter = new PDFExporter()
      const doc = exporter.exportAnalytics({
        totalWaste: 100,
        wasteByType: { Plastic: 60, Metal: 40 },
        verificationRate: 0.75,
        averageWeight: 2.5
      })
      expect(doc).toBeDefined()
    })

    it('calls autoTable with waste-type breakdown', () => {
      const exporter = new PDFExporter()
      exporter.exportAnalytics({
        totalWaste: 50,
        wasteByType: { Glass: 50 },
        verificationRate: 1.0,
        averageWeight: 1.0
      })
      expect(mockAutoTable).toHaveBeenCalled()
    })

    it('includes verification rate in text', () => {
      const exporter = new PDFExporter()
      exporter.exportAnalytics({
        totalWaste: 10,
        wasteByType: {},
        verificationRate: 0.8,
        averageWeight: 3.0
      })
      const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
      expect(allTextArgs.some((t) => t.includes('80.0%'))).toBe(true)
    })
  })

  describe('exportAnalyticsMonthly()', () => {
    it('returns a jsPDF doc object', () => {
      const exporter = new PDFExporter()
      const doc = exporter.exportAnalyticsMonthly([makeAnalyticsRow('Jan')])
      expect(doc).toBeDefined()
    })

    it('includes summary averages in output', () => {
      const exporter = new PDFExporter()
      exporter.exportAnalyticsMonthly([
        makeAnalyticsRow('Jan', { plastic: 50, metal: 30, glass: 20 })
      ])
      const allTextArgs = mockText.mock.calls.map((c) => c[0] as string)
      expect(allTextArgs.some((t) => t.includes('Avg Plastic'))).toBe(true)
    })

    it('calls autoTable with monthly rows', () => {
      const exporter = new PDFExporter()
      exporter.exportAnalyticsMonthly([makeAnalyticsRow()])
      expect(mockAutoTable).toHaveBeenCalled()
    })
  })

  describe('save() and getBlob()', () => {
    it('save() calls jsPDF.save with filename', () => {
      const exporter = new PDFExporter()
      exporter.save('my-report.pdf')
      expect(mockSave).toHaveBeenCalledWith('my-report.pdf')
    })

    it('getBlob() returns a Blob', () => {
      const exporter = new PDFExporter()
      const blob = exporter.getBlob()
      expect(blob).toBeInstanceOf(Blob)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  parseWasteCSV
// ═══════════════════════════════════════════════════════════════════════════

describe('parseWasteCSV', () => {
  const VALID_CSV = [
    'waste_type,weight,latitude,longitude',
    'Plastic,1500,40.7128,-74.006',
    'Metal,2300,51.5074,-0.1278'
  ].join('\n')

  it('parses valid CSV and returns valid: true', () => {
    const result = parseWasteCSV(VALID_CSV)
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('returns correct number of data rows', () => {
    const result = parseWasteCSV(VALID_CSV)
    expect(result.data.length).toBe(2)
  })

  it('preview array contains one entry per data row', () => {
    const result = parseWasteCSV(VALID_CSV)
    expect(result.preview.length).toBe(2)
  })

  it('preview rows are marked valid', () => {
    const result = parseWasteCSV(VALID_CSV)
    result.preview.forEach((row) => {
      expect(row.valid).toBe(true)
      expect(row.errors.length).toBe(0)
    })
  })

  it('assigns correct rowNumber (1-based with header = row 2 onwards)', () => {
    const result = parseWasteCSV(VALID_CSV)
    expect(result.preview[0].rowNumber).toBe(2)
    expect(result.preview[1].rowNumber).toBe(3)
  })

  it('trims header whitespace', () => {
    const csv = ' waste_type , weight , latitude , longitude \nPlastic,500,10,20'
    const result = parseWasteCSV(csv)
    expect(result.errors.filter((e) => e.includes('Missing required'))).toHaveLength(0)
  })

  // ── Missing header tests ──────────────────────────────────────────────────

  it('returns valid: false when waste_type column is missing', () => {
    const csv = 'weight,latitude,longitude\n500,10,20'
    const result = parseWasteCSV(csv)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('waste_type'))).toBe(true)
  })

  it('returns valid: false when weight column is missing', () => {
    const csv = 'waste_type,latitude,longitude\nPlastic,10,20'
    const result = parseWasteCSV(csv)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('weight'))).toBe(true)
  })

  it('returns valid: false when latitude column is missing', () => {
    const csv = 'waste_type,weight,longitude\nPlastic,500,20'
    const result = parseWasteCSV(csv)
    expect(result.valid).toBe(false)
  })

  it('returns valid: false when longitude column is missing', () => {
    const csv = 'waste_type,weight,latitude\nPlastic,500,10'
    const result = parseWasteCSV(csv)
    expect(result.valid).toBe(false)
  })

  // ── Row-level validation ──────────────────────────────────────────────────

  it('marks row invalid for invalid waste_type', () => {
    const csv = 'waste_type,weight,latitude,longitude\nNotAType,500,10,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
    expect(result.preview[0].errors.some((e) => e.includes('waste_type'))).toBe(true)
  })

  it('marks row invalid for negative weight', () => {
    const csv = 'waste_type,weight,latitude,longitude\nPlastic,-1,10,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
    expect(result.preview[0].errors.some((e) => e.includes('weight'))).toBe(true)
  })

  it('marks row invalid for zero weight', () => {
    const csv = 'waste_type,weight,latitude,longitude\nMetal,0,10,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
  })

  it('marks row invalid for non-numeric weight', () => {
    const csv = 'waste_type,weight,latitude,longitude\nGlass,abc,10,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
  })

  it('marks row invalid for latitude > 90', () => {
    const csv = 'waste_type,weight,latitude,longitude\nPlastic,100,91,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
    expect(result.preview[0].errors.some((e) => e.includes('latitude'))).toBe(true)
  })

  it('marks row invalid for latitude < -90', () => {
    const csv = 'waste_type,weight,latitude,longitude\nPlastic,100,-91,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
  })

  it('marks row invalid for longitude > 180', () => {
    const csv = 'waste_type,weight,latitude,longitude\nPlastic,100,10,181'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
    expect(result.preview[0].errors.some((e) => e.includes('longitude'))).toBe(true)
  })

  it('marks row invalid for longitude < -180', () => {
    const csv = 'waste_type,weight,latitude,longitude\nPlastic,100,10,-181'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
  })

  it('marks row invalid when waste_type is empty', () => {
    const csv = 'waste_type,weight,latitude,longitude\n,100,10,20'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(false)
  })

  // ── Edge-case parsing ─────────────────────────────────────────────────────

  it('handles empty CSV string gracefully', () => {
    const result = parseWasteCSV('')
    expect(result.valid).toBe(false)
  })

  it('handles header-only CSV (no data rows)', () => {
    const csv = 'waste_type,weight,latitude,longitude'
    const result = parseWasteCSV(csv)
    expect(result.data.length).toBe(0)
    expect(result.preview.length).toBe(0)
  })

  it('accumulates multiple row-level errors per row', () => {
    const csv = 'waste_type,weight,latitude,longitude\nNotAType,-1,999,-999'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].errors.length).toBeGreaterThan(1)
  })

  it('valid rows are included in data, invalid rows are excluded', () => {
    const csv = [
      'waste_type,weight,latitude,longitude',
      'Plastic,100,10,20', // valid
      'NotAType,-1,999,-999' // invalid
    ].join('\n')
    const result = parseWasteCSV(csv)
    expect(result.data.length).toBe(1)
    expect(result.preview.length).toBe(2)
  })

  it('accepts waste_type as numeric string matching enum value', () => {
    // WasteType.Plastic = 0 in the enum
    const csv = `waste_type,weight,latitude,longitude\n0,100,10,20`
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(true)
  })

  it('accepts all valid named waste types', () => {
    const types = ['Plastic', 'Metal', 'Glass', 'Paper', 'Organic', 'Electronic']
    for (const t of types) {
      const csv = `waste_type,weight,latitude,longitude\n${t},100,10,20`
      const result = parseWasteCSV(csv)
      expect(result.preview[0].valid).toBe(true)
    }
  })

  it('boundary: latitude exactly 90 is valid', () => {
    const csv = 'waste_type,weight,latitude,longitude\nPlastic,100,90,0'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(true)
  })

  it('boundary: longitude exactly -180 is valid', () => {
    const csv = 'waste_type,weight,latitude,longitude\nMetal,100,0,-180'
    const result = parseWasteCSV(csv)
    expect(result.preview[0].valid).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  generateWasteTemplateCSV
// ═══════════════════════════════════════════════════════════════════════════

describe('generateWasteTemplateCSV', () => {
  it('returns a non-empty string', () => {
    const template = generateWasteTemplateCSV()
    expect(typeof template).toBe('string')
    expect(template.length).toBeGreaterThan(0)
  })

  it('first line is the correct header', () => {
    const template = generateWasteTemplateCSV()
    const header = template.split('\n')[0]
    expect(header).toBe('waste_type,weight,latitude,longitude')
  })

  it('template includes example rows', () => {
    const template = generateWasteTemplateCSV()
    const lines = template.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(1)
  })

  it('example rows pass parseWasteCSV validation', () => {
    const template = generateWasteTemplateCSV()
    const result = parseWasteCSV(template)
    expect(result.valid).toBe(true)
    expect(result.data.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  triggerDownload
// ═══════════════════════════════════════════════════════════════════════════

describe('triggerDownload', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:http://localhost/fake-url')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()

    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy },
      writable: true
    })

    const fakeLink = {
      href: '',
      download: '',
      click: clickSpy
    } as unknown as HTMLAnchorElement

    vi.spyOn(document, 'createElement').mockReturnValue(fakeLink as HTMLAnchorElement)
    appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockReturnValue(fakeLink as HTMLAnchorElement)
    removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockReturnValue(fakeLink as HTMLAnchorElement)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls URL.createObjectURL with the provided blob', () => {
    const blob = new Blob(['test'], { type: 'text/csv' })
    triggerDownload(blob, 'test.csv')
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
  })

  it('sets the download filename on the anchor element', () => {
    const blob = new Blob(['test'])
    const fakeLink = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(fakeLink)

    triggerDownload(blob, 'export.json')
    expect(fakeLink.download).toBe('export.json')
  })

  it('calls click() on the anchor element', () => {
    const blob = new Blob(['test'])
    triggerDownload(blob, 'test.csv')
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('appends and removes the anchor from document body', () => {
    const blob = new Blob(['test'])
    triggerDownload(blob, 'test.csv')
    expect(appendChildSpy).toHaveBeenCalledOnce()
    expect(removeChildSpy).toHaveBeenCalledOnce()
  })

  it('revokes the object URL after download', () => {
    const blob = new Blob(['test'])
    triggerDownload(blob, 'test.csv')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-url')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  Performance: large dataset fixtures
// ═══════════════════════════════════════════════════════════════════════════

describe('Performance — large datasets (≥ 1000 rows)', () => {
  const LARGE_N = 1000

  const largeWasteArray = Array.from({ length: LARGE_N }, (_, i) =>
    makeWaste({
      waste_id: i,
      waste_type: i % 2 === 0 ? WasteType.Plastic : WasteType.Metal,
      current_owner: `GOWNER${i.toString().padStart(8, '0')}`
    })
  )

  const largeAnalyticsArray = Array.from({ length: LARGE_N }, (_, i) =>
    makeAnalyticsRow(`Month-${i}`, { plastic: i % 100, metal: (i + 1) % 100, glass: (i + 2) % 100 })
  )

  it(`exportWasteToCSV handles ${LARGE_N} rows in under 2 seconds`, async () => {
    const start = Date.now()
    const blob = exportWasteToCSV(largeWasteArray)
    const elapsed = Date.now() - start

    expect(blob.size).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000)
  }, 5000)

  it(`exportWasteToJSON handles ${LARGE_N} rows in under 2 seconds`, async () => {
    const start = Date.now()
    const blob = exportWasteToJSON(largeWasteArray)
    const elapsed = Date.now() - start

    expect(blob.size).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000)
  }, 5000)

  it(`exportAnalyticsToCSV handles ${LARGE_N} rows in under 1 second`, () => {
    const start = Date.now()
    const blob = exportAnalyticsToCSV(largeAnalyticsArray)
    const elapsed = Date.now() - start

    expect(blob.size).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(1000)
  })

  it(`parseWasteCSV handles ${LARGE_N} valid rows in under 2 seconds`, () => {
    const header = 'waste_type,weight,latitude,longitude'
    const rows = Array.from(
      { length: LARGE_N },
      (_, i) => `Plastic,${100 + i},${(i % 180) - 90},${(i % 360) - 180}`
    )
    const csv = [header, ...rows].join('\n')

    const start = Date.now()
    const result = parseWasteCSV(csv)
    const elapsed = Date.now() - start

    expect(result.data.length).toBe(LARGE_N)
    expect(result.valid).toBe(true)
    expect(elapsed).toBeLessThan(2000)
  }, 5000)

  it(`CSV output for ${LARGE_N} rows contains correct row count`, async () => {
    const blob = exportWasteToCSV(largeWasteArray)
    const text = await blobToText(blob)
    const lines = text.split('\n').filter(Boolean)
    // header + LARGE_N data rows
    expect(lines.length).toBe(LARGE_N + 1)
  })

  it(`JSON output for ${LARGE_N} rows is valid JSON`, async () => {
    const blob = exportWasteToJSON(largeWasteArray)
    const data = (await blobToJson(blob)) as unknown[]
    expect(data.length).toBe(LARGE_N)
  })
})
