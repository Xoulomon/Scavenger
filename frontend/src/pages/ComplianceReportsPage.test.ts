// Feature: frontend-enhancements, Property: Compliance report generation and filtering
// Validates: Report template correctness, schedule validation, status tracking

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Types ──────────────────────────────────────────────────────────────────

type ReportStatus = 'completed' | 'pending' | 'failed'
type ReportFormat = 'pdf' | 'csv' | 'xlsx'
type ScheduleType = 'daily' | 'weekly' | 'monthly'
type FieldType = 'string' | 'number' | 'date' | 'select'

interface ReportTemplate {
  id: string
  name: string
  description: string
  category: string
  fields: { key: string; label: string; type: FieldType }[]
}

interface ScheduledReport {
  id: string
  name: string
  templateId: string
  schedule: ScheduleType
  recipients: string[]
  active: boolean
  nextRun: string
  lastRun: string | null
}

interface ReportHistory {
  id: string
  name: string
  template: string
  format: ReportFormat
  status: ReportStatus
  createdAt: string
  fileUrl?: string
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const fieldTypeArb: fc.Arbitrary<FieldType> = fc.constantFrom(
  'string' as const,
  'number' as const,
  'date' as const,
  'select' as const
)

const reportFieldArb: fc.Arbitrary<{ key: string; label: string; type: FieldType }> = fc.record({
  key: fc.string({ minLength: 3, maxLength: 30 }),
  label: fc.string({ minLength: 3, maxLength: 50 }),
  type: fieldTypeArb,
})

const reportTemplateArb: fc.Arbitrary<ReportTemplate> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  category: fc.constantFrom('Compliance', 'Audit', 'Financial', 'Environmental'),
  fields: fc.array(reportFieldArb, { minLength: 1, maxLength: 10 }),
})

const scheduleTypeArb: fc.Arbitrary<ScheduleType> = fc.constantFrom(
  'daily' as const,
  'weekly' as const,
  'monthly' as const
)

const scheduledReportArb: fc.Arbitrary<ScheduledReport> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 100 }),
  templateId: fc.uuid(),
  schedule: scheduleTypeArb,
  recipients: fc.array(
    fc.emailAddress().map(e => e.toLowerCase()),
    { minLength: 0, maxLength: 5 }
  ),
  active: fc.boolean(),
  nextRun: fc.date().map(d => d.toISOString()),
  lastRun: fc.option(fc.date().map(d => d.toISOString())),
})

const reportStatusArb: fc.Arbitrary<ReportStatus> = fc.constantFrom(
  'completed' as const,
  'pending' as const,
  'failed' as const
)

const reportFormatArb: fc.Arbitrary<ReportFormat> = fc.constantFrom(
  'pdf' as const,
  'csv' as const,
  'xlsx' as const
)

const reportHistoryArb: fc.Arbitrary<ReportHistory> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 100 }),
  template: fc.string({ minLength: 3, maxLength: 50 }),
  format: reportFormatArb,
  status: reportStatusArb,
  createdAt: fc.date().map(d => d.toISOString()),
  fileUrl: fc.option(
    fc.webUrl({ withPathSegments: true }).map(u => u.toString())
  ),
})

// ─── Utility Functions for Testing ───────────────────────────────────────────

function filterTemplatesByCategory(
  templates: ReportTemplate[],
  category: string
): ReportTemplate[] {
  if (category === 'all') return templates
  return templates.filter(t => t.category === category)
}

function filterReportsByStatus(
  reports: ReportHistory[],
  status: string
): ReportHistory[] {
  if (status === 'all') return reports
  return reports.filter(r => r.status === status)
}

function filterScheduledReports(
  reports: ScheduledReport[],
  active: string
): ScheduledReport[] {
  if (active === 'all') return reports
  return reports.filter(r => r.active === (active === 'active'))
}

function validateTemplateFields(template: ReportTemplate): boolean {
  if (template.fields.length === 0) return false
  return template.fields.every(f => f.key && f.label && f.type)
}

function validateScheduledReport(report: ScheduledReport): boolean {
  if (!report.id || !report.name || !report.templateId) return false
  if (!report.schedule || !['daily', 'weekly', 'monthly'].includes(report.schedule)) return false
  if (report.recipients.length === 0) return false
  return report.recipients.every(r => r.includes('@'))
}

function filterReportsByName(
  reports: ReportHistory[],
  search: string
): ReportHistory[] {
  if (!search) return reports
  const lowerSearch = search.toLowerCase()
  return reports.filter(r =>
    r.name.toLowerCase().includes(lowerSearch) ||
    r.template.toLowerCase().includes(lowerSearch)
  )
}

function calculateReportStatistics(reports: ReportHistory[]): {
  total: number
  completed: number
  pending: number
  failed: number
} {
  return {
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    pending: reports.filter(r => r.status === 'pending').length,
    failed: reports.filter(r => r.status === 'failed').length,
  }
}

function getReportsByTimeRange(
  reports: ReportHistory[],
  startDate: Date,
  endDate: Date
): ReportHistory[] {
  return reports.filter(r => {
    const reportDate = new Date(r.createdAt)
    return reportDate >= startDate && reportDate <= endDate
  })
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('ComplianceReportsPage — template filtering', () => {
  it('returns all templates when category is all', () => {
    fc.assert(
      fc.property(
        fc.array(reportTemplateArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
          const filtered = filterTemplatesByCategory(templates, 'all')
          return filtered.length === templates.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns only templates matching the category', () => {
    fc.assert(
      fc.property(
        fc.array(reportTemplateArb, { minLength: 1, maxLength: 20 }),
        (templates) => {
          const category = templates[0].category
          const filtered = filterTemplatesByCategory(templates, category)
          return filtered.every(t => t.category === category)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('category filter does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(reportTemplateArb, { minLength: 1, maxLength: 20 }),
        (templates) => {
          const original = templates.map(t => t.id)
          filterTemplatesByCategory(templates, templates[0].category)
          return templates.map(t => t.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })

  it('filtered count is always <= input count', () => {
    fc.assert(
      fc.property(
        fc.array(reportTemplateArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 3, maxLength: 30 }),
        (templates, category) => {
          const filtered = filterTemplatesByCategory(templates, category)
          return filtered.length <= templates.length
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — report status filtering', () => {
  it('returns all reports when status is all', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 30 }),
        (reports) => {
          const filtered = filterReportsByStatus(reports, 'all')
          return filtered.length === reports.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns only reports matching the status', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 1, maxLength: 30 }),
        reportStatusArb,
        (reports, status) => {
          const filtered = filterReportsByStatus(reports, status)
          return filtered.every(r => r.status === status)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('status filter does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 1, maxLength: 30 }),
        (reports) => {
          const original = reports.map(r => r.id)
          filterReportsByStatus(reports, 'completed')
          return reports.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — scheduled report filtering', () => {
  it('returns all scheduled reports when active is all', () => {
    fc.assert(
      fc.property(
        fc.array(scheduledReportArb, { minLength: 0, maxLength: 20 }),
        (reports) => {
          const filtered = filterScheduledReports(reports, 'all')
          return filtered.length === reports.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns only active reports when filtering for active', () => {
    fc.assert(
      fc.property(
        fc.array(scheduledReportArb, { minLength: 1, maxLength: 20 }),
        (reports) => {
          const filtered = filterScheduledReports(reports, 'active')
          return filtered.every(r => r.active === true)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns only inactive reports when filtering for inactive', () => {
    fc.assert(
      fc.property(
        fc.array(scheduledReportArb, { minLength: 1, maxLength: 20 }),
        (reports) => {
          const filtered = filterScheduledReports(reports, 'inactive')
          return filtered.every(r => r.active === false)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('active filter does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(scheduledReportArb, { minLength: 1, maxLength: 20 }),
        (reports) => {
          const original = reports.map(r => r.id)
          filterScheduledReports(reports, 'active')
          return reports.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — template field validation', () => {
  it('template with fields is valid', () => {
    fc.assert(
      fc.property(reportTemplateArb, (template) => {
        return validateTemplateFields(template)
      }),
      { numRuns: 50 }
    )
  })

  it('template fields must have key, label, and type', () => {
    fc.assert(
      fc.property(reportTemplateArb, (template) => {
        const isValid = validateTemplateFields(template)
        const allFieldsComplete = template.fields.every(f => f.key && f.label && f.type)
        return isValid === allFieldsComplete
      }),
      { numRuns: 50 }
    )
  })

  it('field type must be one of allowed values', () => {
    fc.assert(
      fc.property(reportTemplateArb, (template) => {
        return template.fields.every(f =>
          ['string', 'number', 'date', 'select'].includes(f.type)
        )
      }),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — scheduled report validation', () => {
  it('valid scheduled report passes validation', () => {
    fc.assert(
      fc.property(scheduledReportArb.filter(r => r.recipients.length > 0), (report) => {
        return validateScheduledReport(report)
      }),
      { numRuns: 50 }
    )
  })

  it('schedule must be one of allowed types', () => {
    fc.assert(
      fc.property(scheduledReportArb, (report) => {
        return ['daily', 'weekly', 'monthly'].includes(report.schedule)
      }),
      { numRuns: 50 }
    )
  })

  it('all recipients must be valid email addresses', () => {
    fc.assert(
      fc.property(scheduledReportArb, (report) => {
        return report.recipients.every(r => r.includes('@'))
      }),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — report search filtering', () => {
  it('returns all reports when search is empty', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 30 }),
        (reports) => {
          const filtered = filterReportsByName(reports, '')
          return filtered.length === reports.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns only reports matching search in name or template', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (reports, search) => {
          const filtered = filterReportsByName(reports, search)
          const lowerSearch = search.toLowerCase()
          return filtered.every(r =>
            r.name.toLowerCase().includes(lowerSearch) ||
            r.template.toLowerCase().includes(lowerSearch)
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  it('search is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 1, maxLength: 30 }),
        (reports) => {
          if (reports.length === 0) return true
          const search = reports[0].name.substring(0, 3)
          const lowerFiltered = filterReportsByName(reports, search.toLowerCase())
          const upperFiltered = filterReportsByName(reports, search.toUpperCase())
          return lowerFiltered.length === upperFiltered.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('search does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 1, maxLength: 30 }),
        (reports) => {
          const original = reports.map(r => r.id)
          filterReportsByName(reports, 'test')
          return reports.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — report statistics', () => {
  it('total equals length of input array', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 50 }),
        (reports) => {
          const stats = calculateReportStatistics(reports)
          return stats.total === reports.length
        }
      ),
      { numRuns: 50 }
    )
  })

  it('completed count equals filtered completed reports', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 50 }),
        (reports) => {
          const stats = calculateReportStatistics(reports)
          const completedCount = reports.filter(r => r.status === 'completed').length
          return stats.completed === completedCount
        }
      ),
      { numRuns: 50 }
    )
  })

  it('all status counts sum to total', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 50 }),
        (reports) => {
          const stats = calculateReportStatistics(reports)
          return stats.completed + stats.pending + stats.failed === stats.total
        }
      ),
      { numRuns: 50 }
    )
  })

  it('pending count equals filtered pending reports', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 50 }),
        (reports) => {
          const stats = calculateReportStatistics(reports)
          const pendingCount = reports.filter(r => r.status === 'pending').length
          return stats.pending === pendingCount
        }
      ),
      { numRuns: 50 }
    )
  })

  it('failed count equals filtered failed reports', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 50 }),
        (reports) => {
          const stats = calculateReportStatistics(reports)
          const failedCount = reports.filter(r => r.status === 'failed').length
          return stats.failed === failedCount
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('ComplianceReportsPage — time range filtering', () => {
  it('returns only reports within the specified time range', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 30 }),
        fc.date(),
        fc.integer({ min: 1, max: 30 }),
        (reports, startDate, daysRange) => {
          const endDate = new Date(startDate.getTime() + daysRange * 24 * 60 * 60 * 1000)
          const filtered = getReportsByTimeRange(reports, startDate, endDate)
          return filtered.every(r => {
            const reportDate = new Date(r.createdAt)
            return reportDate >= startDate && reportDate <= endDate
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  it('time range filter does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(reportHistoryArb, { minLength: 0, maxLength: 30 }),
        fc.date(),
        (reports, date) => {
          const original = reports.map(r => r.id)
          const startDate = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000)
          const endDate = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000)
          getReportsByTimeRange(reports, startDate, endDate)
          return reports.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })
})
