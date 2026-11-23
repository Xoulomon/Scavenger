import { Waste, WasteType, Participant, ParticipantStats } from '@/api/types'
import Papa from 'papaparse'
import { jsPDF } from 'jspdf'
import { wasteTypeLabel, roleLabel } from './helpers'
import { formatDate } from './format'

/* ────────────────────────────────────────────────────────────────
   CSV / JSON Export — Waste records
   ──────────────────────────────────────────────────────────────── */

export function exportWasteToCSV(wastes: Waste[]): Blob {
  const headers = [
    'waste_id',
    'waste_type',
    'weight',
    'current_owner',
    'latitude',
    'longitude',
    'recycled_timestamp',
    'is_active',
    'is_confirmed',
    'confirmer'
  ]
  const rows = wastes.map((w) => [
    w.waste_id.toString(),
    wasteTypeLabel(w.waste_type),
    w.weight.toString(),
    w.current_owner,
    w.latitude.toString(),
    w.longitude.toString(),
    new Date(w.recycled_timestamp * 1000).toISOString(),
    w.is_active ? 'true' : 'false',
    w.is_confirmed ? 'true' : 'false',
    w.confirmer
  ])
  const csv = [headers, ...rows].map((r) => r.map(escapeCsvCell).join(',')).join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}

export function exportWasteToJSON(wastes: Waste[]): Blob {
  const data = wastes.map((w) => ({
    waste_id: w.waste_id.toString(),
    waste_type: wasteTypeLabel(w.waste_type),
    weight: w.weight.toString(),
    current_owner: w.current_owner,
    latitude: w.latitude.toString(),
    longitude: w.longitude.toString(),
    recycled_timestamp: w.recycled_timestamp,
    is_active: w.is_active,
    is_confirmed: w.is_confirmed,
    confirmer: w.confirmer
  }))
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

function escapeCsvCell(val: string): string {
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`
  return val
}

/* ────────────────────────────────────────────────────────────────
   CSV Export — Analytics monthly data
   ──────────────────────────────────────────────────────────────── */

export interface AnalyticsMonthlyRow {
  month: string
  plastic: number
  metal: number
  glass: number
}

export function exportAnalyticsToCSV(data: AnalyticsMonthlyRow[]): Blob {
  const headers = ['Month', 'Plastic (%)', 'Metal (%)', 'Glass (%)']
  const rows = data.map((d) => [d.month, d.plastic, d.metal, d.glass])
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}

/* ────────────────────────────────────────────────────────────────
   PDF Export — Participant stats
   ──────────────────────────────────────────────────────────────── */

export function exportParticipantStatsToPDF(
  participant: Participant,
  stats: ParticipantStats
): Blob {
  const doc = new jsPDF()
  const margin = 14
  let y = 20

  doc.setFontSize(18)
  doc.text('Participant Report', margin, y)
  y += 10

  doc.setFontSize(12)
  doc.text(`Name: ${participant.name}`, margin, y)
  y += 7
  doc.text(`Address: ${participant.address}`, margin, y)
  y += 7
  doc.text(`Role: ${roleLabel(participant.role)}`, margin, y)
  y += 7
  doc.text(`Registered: ${formatDate(participant.registered_at)}`, margin, y)
  y += 12

  doc.setFontSize(14)
  doc.text('Statistics', margin, y)
  y += 10

  doc.setFontSize(12)
  doc.text(`Total Earned: ${stats.total_earned.toString()}`, margin, y)
  y += 7
  doc.text(`Materials Submitted: ${stats.materials_submitted}`, margin, y)
  y += 7
  doc.text(`Transfers Count: ${stats.transfers_count}`, margin, y)
  y += 12

  doc.setFontSize(10)
  doc.setTextColor(150)
  doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y)

  return doc.output('blob')
}

/* ────────────────────────────────────────────────────────────────
   PDF Export — Waste data table (with optional autotable)
   ──────────────────────────────────────────────────────────────── */

export interface WasteExportData {
  id: string
  type: string
  weight: number
  status: string
  date: Date
  location?: { lat: number; lon: number }
  verificationStatus?: string
  notes?: string
}

export interface PDFExportOptions {
  title?: string
  includeMetadata?: boolean
  includeCharts?: boolean
  orientation?: 'portrait' | 'landscape'
  format?: 'a4' | 'letter'
}

export class PDFExporter {
  private doc: jsPDF

  constructor(options: PDFExportOptions = {}) {
    this.doc = new jsPDF({
      orientation: options.orientation ?? 'portrait',
      unit: 'mm',
      format: options.format ?? 'a4'
    })
  }

  private addHeader(title: string): void {
    this.doc.setFontSize(20)
    this.doc.text(title, 15, 20)
    this.doc.setFontSize(10)
    this.doc.setTextColor(100)
    this.doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 28)
    this.doc.setDrawColor(200)
    this.doc.line(15, 32, 195, 32)
  }

  private addFooter(): void {
    const pageCount = this.doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      this.doc.setFontSize(8)
      this.doc.setTextColor(150)
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.doc.internal.pageSize.getWidth() / 2,
        this.doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }
  }

  exportWasteData(wastes: WasteExportData[], options: PDFExportOptions = {}): jsPDF {
    const title = options.title ?? 'Waste Report'
    this.addHeader(title)

    let yPosition = 40

    if (options.includeMetadata) {
      this.doc.setFontSize(12)
      this.doc.setTextColor(0)
      this.doc.text('Summary', 15, yPosition)
      yPosition += 8

      this.doc.setFontSize(10)
      this.doc.setTextColor(80)
      const totalWeight = wastes.reduce((sum, w) => sum + w.weight, 0)
      const verifiedCount = wastes.filter((w) => w.verificationStatus === 'verified').length

      this.doc.text(`Total Items: ${wastes.length}`, 15, yPosition)
      yPosition += 6
      this.doc.text(`Total Weight: ${totalWeight.toFixed(2)} kg`, 15, yPosition)
      yPosition += 6
      this.doc.text(`Verified Items: ${verifiedCount}`, 15, yPosition)
      yPosition += 12
    }

    const tableData = wastes.map((waste) => [
      waste.id,
      waste.type,
      waste.weight.toFixed(2),
      waste.status,
      new Date(waste.date).toLocaleDateString(),
      waste.verificationStatus ?? 'N/A'
    ])

    ;(this.doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      head: [['ID', 'Type', 'Weight (kg)', 'Status', 'Date', 'Verification']],
      body: tableData,
      startY: yPosition,
      margin: { top: 10, right: 15, bottom: 20, left: 15 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    })

    this.addFooter()
    return this.doc
  }

  exportAnalytics(
    data: {
      totalWaste: number
      wasteByType: Record<string, number>
      verificationRate: number
      averageWeight: number
    },
    options: PDFExportOptions = {}
  ): jsPDF {
    const title = options.title ?? 'Analytics Report'
    this.addHeader(title)

    let yPosition = 40

    this.doc.setFontSize(12)
    this.doc.setTextColor(0)
    this.doc.text('Key Metrics', 15, yPosition)
    yPosition += 8

    this.doc.setFontSize(10)
    this.doc.setTextColor(80)

    const metrics = [
      `Total Waste Items: ${data.totalWaste}`,
      `Average Weight: ${data.averageWeight.toFixed(2)} kg`,
      `Verification Rate: ${(data.verificationRate * 100).toFixed(1)}%`
    ]

    metrics.forEach((metric) => {
      this.doc.text(metric, 15, yPosition)
      yPosition += 6
    })

    yPosition += 6
    this.doc.setFontSize(12)
    this.doc.text('Waste by Type', 15, yPosition)
    yPosition += 8

    const typeData = Object.entries(data.wasteByType).map(([type, count]) => [
      type,
      count.toString()
    ])

    ;(this.doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      head: [['Waste Type', 'Count']],
      body: typeData,
      startY: yPosition,
      margin: { top: 10, right: 15, bottom: 20, left: 15 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }
    })

    this.addFooter()
    return this.doc
  }

  exportAnalyticsMonthly(data: AnalyticsMonthlyRow[], options: PDFExportOptions = {}): jsPDF {
    const title = options.title ?? 'Monthly Analytics Report'
    this.addHeader(title)

    let yPosition = 40

    const avgPlastic = Math.round(data.reduce((s, d) => s + d.plastic, 0) / data.length)
    const avgMetal = Math.round(data.reduce((s, d) => s + d.metal, 0) / data.length)
    const avgGlass = Math.round(data.reduce((s, d) => s + d.glass, 0) / data.length)

    this.doc.setFontSize(12)
    this.doc.setTextColor(0)
    this.doc.text('Summary', 15, yPosition)
    yPosition += 8

    this.doc.setFontSize(10)
    this.doc.setTextColor(80)
    this.doc.text(`Total entries: ${data.length}`, 15, yPosition)
    yPosition += 6
    this.doc.text(`Avg Plastic: ${avgPlastic}%`, 15, yPosition)
    yPosition += 6
    this.doc.text(`Avg Metal: ${avgMetal}%`, 15, yPosition)
    yPosition += 6
    this.doc.text(`Avg Glass: ${avgGlass}%`, 15, yPosition)
    yPosition += 10

    const tableData = data.map((d) => [d.month, `${d.plastic}%`, `${d.metal}%`, `${d.glass}%`])

    ;(this.doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      head: [['Month', 'Plastic (%)', 'Metal (%)', 'Glass (%)']],
      body: tableData,
      startY: yPosition,
      margin: { top: 10, right: 15, bottom: 20, left: 15 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    })

    this.addFooter()
    return this.doc
  }

  save(filename: string): void {
    this.doc.save(filename)
  }

  getBlob(): Blob {
    return this.doc.output('blob')
  }
}

/* ────────────────────────────────────────────────────────────────
   CSV Import (Admin)
   ──────────────────────────────────────────────────────────────── */

export interface ImportWasteRow {
  waste_type: string
  weight: string
  latitude: string
  longitude: string
}

export interface ParsedImportResult {
  data: ImportWasteRow[]
  errors: string[]
  valid: boolean
  preview: ImportPreviewRow[]
}

export interface ImportPreviewRow extends ImportWasteRow {
  rowNumber: number
  errors: string[]
  valid: boolean
}

const VALID_WASTE_TYPES = Object.values(WasteType).filter((v): v is number => typeof v === 'number')

export function parseWasteCSV(csvText: string): ParsedImportResult {
  const parseResult = Papa.parse<ImportWasteRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase()
  })

  const errors: string[] = []
  if (parseResult.errors.length > 0) {
    errors.push(...parseResult.errors.map((e) => `Parse error: ${e.message}`))
  }

  const requiredHeaders = ['waste_type', 'weight', 'latitude', 'longitude']
  const headers = parseResult.meta.fields ?? []
  const missing = requiredHeaders.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`)
  }

  const preview: ImportPreviewRow[] = []
  const data: ImportWasteRow[] = []

  parseResult.data.forEach((row, idx) => {
    const rowNumber = idx + 2 // 1-based with header
    const rowErrors: string[] = []

    if (!row.waste_type || row.waste_type.trim() === '') {
      rowErrors.push('waste_type is required')
    } else {
      const normalized = row.waste_type.trim().toLowerCase()
      const isValidType = VALID_WASTE_TYPES.some(
        (wt) => wasteTypeLabel(wt).toLowerCase() === normalized || String(wt) === normalized
      )
      if (!isValidType) {
        rowErrors.push(`Invalid waste_type: "${row.waste_type}"`)
      }
    }

    const weightNum = Number(row.weight)
    if (Number.isNaN(weightNum) || weightNum <= 0) {
      rowErrors.push('weight must be a positive number')
    }

    const latNum = Number(row.latitude)
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      rowErrors.push('latitude must be between -90 and 90')
    }

    const lonNum = Number(row.longitude)
    if (Number.isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      rowErrors.push('longitude must be between -180 and 180')
    }

    const previewRow: ImportPreviewRow = {
      ...row,
      rowNumber,
      errors: rowErrors,
      valid: rowErrors.length === 0
    }
    preview.push(previewRow)
    if (rowErrors.length === 0) {
      data.push(row)
    }
  })

  return {
    data,
    errors,
    valid: errors.length === 0 && preview.every((r) => r.valid),
    preview
  }
}

/* ────────────────────────────────────────────────────────────────
   Template Download
   ──────────────────────────────────────────────────────────────── */

export function generateWasteTemplateCSV(): string {
  const headers = ['waste_type', 'weight', 'latitude', 'longitude']
  const exampleRows = [
    ['Plastic', '1500', '40.7128', '-74.006'],
    ['Metal', '2300', '51.5074', '-0.1278'],
    ['Glass', '800', '35.6762', '139.6503']
  ]
  return [headers, ...exampleRows].map((r) => r.join(',')).join('\n')
}

/* ────────────────────────────────────────────────────────────────
   Generic Download Trigger
   ──────────────────────────────────────────────────────────────── */

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
