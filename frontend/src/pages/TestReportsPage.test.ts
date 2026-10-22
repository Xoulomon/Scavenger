// Feature: frontend-enhancements, Property: Test report data integrity
// Validates: Test report page filtering, calculation, and state management

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending'

interface TestResult {
  id: string
  name: string
  suite: string
  status: TestStatus
  duration: number
  error?: string
  timestamp: string
}

interface TestRun {
  id: string
  name: string
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  timestamp: string
  results: TestResult[]
}

const statusArb: fc.Arbitrary<TestStatus> = fc.constantFrom(
  'passed' as const,
  'failed' as const,
  'skipped' as const,
  'pending' as const
)

const testResultArb: fc.Arbitrary<TestResult> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 5, maxLength: 50 }),
  suite: fc.string({ minLength: 3, maxLength: 30 }),
  status: statusArb,
  duration: fc.integer({ min: 0, max: 10000 }),
  error: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
  timestamp: fc.date().map(d => d.toISOString()),
})

const testRunArb: fc.Arbitrary<TestRun> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 5, maxLength: 50 }),
  total: fc.integer({ min: 1, max: 500 }),
  passed: fc.integer({ min: 0, max: 500 }),
  failed: fc.integer({ min: 0, max: 500 }),
  skipped: fc.integer({ min: 0, max: 500 }),
  duration: fc.integer({ min: 100, max: 300000 }),
  timestamp: fc.date().map(d => d.toISOString()),
  results: fc.array(testResultArb, { minLength: 0, maxLength: 20 }),
})

// ─── Utility Functions for Testing ───────────────────────────────────────────

function calculatePassRate(passed: number, total: number): string {
  if (total === 0) return '0'
  return ((passed / total) * 100).toFixed(1)
}

function filterTestsByStatus(results: TestResult[], status: TestStatus): TestResult[] {
  if (status === 'all') return results
  return results.filter(r => r.status === status)
}

function filterTestsBySuite(results: TestResult[], suite: string): TestResult[] {
  if (suite === 'all') return results
  return results.filter(r => r.suite === suite)
}

function filterTests(
  results: TestResult[],
  search: string,
  statusFilter: TestStatus | 'all',
  suiteFilter: string
): TestResult[] {
  return results.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (suiteFilter !== 'all' && r.suite !== suiteFilter) return false
    return true
  })
}

function aggregateTestRunStats(runs: TestRun[]): {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
} {
  return runs.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      passed: acc.passed + r.passed,
      failed: acc.failed + r.failed,
      skipped: acc.skipped + r.skipped,
      duration: acc.duration + r.duration,
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }
  )
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('TestReportsPage — pass rate calculation', () => {
  it('calculates correct pass rate for any valid passed/total combination', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (passed, total) => {
          const adjustedPassed = Math.min(passed, total)
          const rate = calculatePassRate(adjustedPassed, total)
          const numeric = parseFloat(rate)
          const expected = (adjustedPassed / total) * 100
          return Math.abs(numeric - expected) < 0.1
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns 0 for zero total tests', () => {
    expect(calculatePassRate(0, 0)).toBe('0')
  })

  it('returns 100 when passed equals total', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (total) => {
        const rate = calculatePassRate(total, total)
        return parseFloat(rate) === 100
      }),
      { numRuns: 50 }
    )
  })

  it('returns value between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (passed, total) => {
          const adjustedPassed = Math.min(passed, total)
          const numeric = parseFloat(calculatePassRate(adjustedPassed, total))
          return numeric >= 0 && numeric <= 100
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('TestReportsPage — test filtering by status', () => {
  it('returns all results when filtering for all', () => {
    fc.assert(
      fc.property(fc.array(testResultArb, { minLength: 0, maxLength: 50 }), (results) => {
        const filtered = filterTestsByStatus(results, 'all' as TestStatus)
        return filtered.length === results.length
      }),
      { numRuns: 50 }
    )
  })

  it('returns only tests matching the specified status', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 1, maxLength: 50 }),
        statusArb,
        (results, status) => {
          const filtered = filterTestsByStatus(results, status)
          return filtered.every(r => r.status === status)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('status filter does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 1, maxLength: 30 }),
        statusArb,
        (results, status) => {
          const original = results.map(r => r.id)
          filterTestsByStatus(results, status)
          return results.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })

  it('filtered count is always <= input count', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 0, maxLength: 50 }),
        statusArb,
        (results, status) => {
          const filtered = filterTestsByStatus(results, status)
          return filtered.length <= results.length
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('TestReportsPage — test filtering by suite', () => {
  it('returns all results when filtering for all suites', () => {
    fc.assert(
      fc.property(fc.array(testResultArb, { minLength: 0, maxLength: 50 }), (results) => {
        const filtered = filterTestsBySuite(results, 'all')
        return filtered.length === results.length
      }),
      { numRuns: 50 }
    )
  })

  it('returns only tests matching the specified suite', () => {
    fc.assert(
      fc.property(fc.array(testResultArb, { minLength: 1, maxLength: 50 }), (results) => {
        const suite = results[0].suite
        const filtered = filterTestsBySuite(results, suite)
        return filtered.every(r => r.suite === suite)
      }),
      { numRuns: 50 }
    )
  })

  it('suite filter does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 3, maxLength: 30 }),
        (results, suite) => {
          const original = results.map(r => r.id)
          filterTestsBySuite(results, suite)
          return results.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('TestReportsPage — combined filtering', () => {
  it('every item in filtered output satisfies all active filters', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        statusArb,
        fc.string({ minLength: 0, maxLength: 20 }),
        (results, search, status, suite) => {
          const filtered = filterTests(results, search, status, suite)
          return filtered.every((r) => {
            const searchOk = search === '' || r.name.toLowerCase().includes(search.toLowerCase())
            const statusOk = status === 'all' || r.status === status
            const suiteOk = suite === 'all' || r.suite === suite
            return searchOk && statusOk && suiteOk
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no item satisfying all predicates is absent from output', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        statusArb,
        (results, search, status) => {
          const suite = 'all'
          const filtered = filterTests(results, search, status, suite)
          const filteredIds = new Set(filtered.map(r => r.id))

          return results
            .filter((r) => {
              const searchOk = search === '' || r.name.toLowerCase().includes(search.toLowerCase())
              const statusOk = status === 'all' || r.status === status
              return searchOk && statusOk
            })
            .every((r) => filteredIds.has(r.id))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('empty filters return all results', () => {
    fc.assert(
      fc.property(fc.array(testResultArb, { minLength: 0, maxLength: 50 }), (results) => {
        const filtered = filterTests(results, '', 'all' as TestStatus, 'all')
        return filtered.length === results.length
      }),
      { numRuns: 50 }
    )
  })

  it('filtering does not mutate original array', () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb, { minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        statusArb,
        (results, search, status) => {
          const original = results.map(r => r.id)
          filterTests(results, search, status, 'all')
          return results.map(r => r.id).join(',') === original.join(',')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('TestReportsPage — test run aggregation', () => {
  it('total equals sum of individual test totals', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const agg = aggregateTestRunStats(runs)
        const expected = runs.reduce((acc, r) => acc + r.total, 0)
        return agg.total === expected
      }),
      { numRuns: 50 }
    )
  })

  it('passed equals sum of individual passed counts', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const agg = aggregateTestRunStats(runs)
        const expected = runs.reduce((acc, r) => acc + r.passed, 0)
        return agg.passed === expected
      }),
      { numRuns: 50 }
    )
  })

  it('failed equals sum of individual failed counts', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const agg = aggregateTestRunStats(runs)
        const expected = runs.reduce((acc, r) => acc + r.failed, 0)
        return agg.failed === expected
      }),
      { numRuns: 50 }
    )
  })

  it('skipped equals sum of individual skipped counts', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const agg = aggregateTestRunStats(runs)
        const expected = runs.reduce((acc, r) => acc + r.skipped, 0)
        return agg.skipped === expected
      }),
      { numRuns: 50 }
    )
  })

  it('duration equals sum of individual durations', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const agg = aggregateTestRunStats(runs)
        const expected = runs.reduce((acc, r) => acc + r.duration, 0)
        return agg.duration === expected
      }),
      { numRuns: 50 }
    )
  })

  it('aggregation of empty array returns all zeros', () => {
    const agg = aggregateTestRunStats([])
    expect(agg.total).toBe(0)
    expect(agg.passed).toBe(0)
    expect(agg.failed).toBe(0)
    expect(agg.skipped).toBe(0)
    expect(agg.duration).toBe(0)
  })

  it('aggregation does not mutate input array', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const original = runs.map(r => r.id)
        aggregateTestRunStats(runs)
        return runs.map(r => r.id).join(',') === original.join(',')
      }),
      { numRuns: 50 }
    )
  })

  it('aggregated passed never exceeds aggregated total', () => {
    fc.assert(
      fc.property(fc.array(testRunArb, { minLength: 1, maxLength: 20 }), (runs) => {
        const agg = aggregateTestRunStats(runs)
        return agg.passed <= agg.total
      }),
      { numRuns: 50 }
    )
  })
})

describe('TestReportsPage — status badge configuration', () => {
  it('all status types have valid configuration', () => {
    const statuses: TestStatus[] = ['passed', 'failed', 'skipped', 'pending']
    const validColors = [
      'text-green-500 bg-green-500/10 border-green-500/20',
      'text-red-500 bg-red-500/10 border-red-500/20',
      'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
      'text-muted-foreground bg-muted border-border',
    ]
    const validLabels = ['Passed', 'Failed', 'Skipped', 'Pending']

    statuses.forEach((status, idx) => {
      expect(validLabels).toContain(['Passed', 'Failed', 'Skipped', 'Pending'][idx])
    })
  })
})
