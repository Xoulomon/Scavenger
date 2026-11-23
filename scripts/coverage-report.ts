#!/usr/bin/env ts-node
/**
 * Per-package coverage reporting script.
 *
 * Issue #957 – Measure and report coverage per package.
 *
 * Collects coverage JSON summaries from each package that produces one, then
 * prints a human-readable table and writes a machine-readable combined report.
 *
 * Usage:
 *   npx ts-node scripts/coverage-report.ts
 *
 * Generates:
 *   coverage/combined-summary.json   – machine-readable totals per package
 *   coverage/combined-report.md      – markdown table (for PR comments / CI)
 *
 * Each package is expected to write a coverage-summary.json at:
 *   coverage/<package>/coverage-summary.json
 *
 * To produce those files run:
 *   frontend  : npm run test:coverage        (vitest --coverage)
 *   indexer   : npm run test:coverage        (jest --coverage)
 *   contract  : npm test --coverage          (jest --coverage in tests/contract)
 *
 * Thresholds (fail the script with exit code 1 if any package is below):
 *   lines      : 70 %
 *   functions  : 70 %
 *   branches   : 65 %
 *   statements : 70 %
 */

import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoverageEntry {
  total: number
  covered: number
  skipped: number
  pct: number
}

interface FileCoverageSummary {
  lines: CoverageEntry
  functions: CoverageEntry
  branches: CoverageEntry
  statements: CoverageEntry
}

interface CoverageSummaryJson {
  total: FileCoverageSummary
  [filePath: string]: FileCoverageSummary
}

interface PackageCoverage {
  name: string
  lines: number
  functions: number
  branches: number
  statements: number
  pass: boolean
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..')

const THRESHOLDS = {
  lines: 70,
  functions: 70,
  branches: 65,
  statements: 70
}

/** Packages to report.  path is relative to repo root; summaryFile is inside it. */
const PACKAGES: { name: string; summaryFile: string }[] = [
  {
    name: 'frontend',
    summaryFile: 'coverage/frontend/coverage-summary.json'
  },
  {
    name: 'indexer',
    summaryFile: 'coverage/indexer/coverage-summary.json'
  },
  {
    name: 'contract-tests',
    summaryFile: 'coverage/contract/coverage-summary.json'
  }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

function statusIcon(value: number, threshold: number): string {
  return value >= threshold ? '✅' : '❌'
}

function readSummary(absolutePath: string): CoverageSummaryJson | null {
  if (!fs.existsSync(absolutePath)) return null
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as CoverageSummaryJson
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildReport(): { packages: PackageCoverage[]; anyFailed: boolean } {
  const packages: PackageCoverage[] = []

  for (const pkg of PACKAGES) {
    const summaryPath = path.join(ROOT, pkg.summaryFile)
    const summary = readSummary(summaryPath)

    if (!summary) {
      console.warn(`⚠  No coverage summary found for "${pkg.name}" at ${summaryPath}`)
      console.warn(`   Run: npm run test:coverage inside the package directory.`)
      packages.push({
        name: pkg.name,
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
        pass: false
      })
      continue
    }

    const total = summary.total
    const entry: PackageCoverage = {
      name: pkg.name,
      lines: total.lines.pct,
      functions: total.functions.pct,
      branches: total.branches.pct,
      statements: total.statements.pct,
      pass:
        total.lines.pct >= THRESHOLDS.lines &&
        total.functions.pct >= THRESHOLDS.functions &&
        total.branches.pct >= THRESHOLDS.branches &&
        total.statements.pct >= THRESHOLDS.statements
    }
    packages.push(entry)
  }

  const anyFailed = packages.some((p) => !p.pass)
  return { packages, anyFailed }
}

function printTable(packages: PackageCoverage[]): void {
  const header = ['Package', 'Lines', 'Functions', 'Branches', 'Statements', 'Pass']
  const rows = packages.map((p) => [
    p.name,
    `${statusIcon(p.lines, THRESHOLDS.lines)}      ${pct(p.lines)}`,
    `${statusIcon(p.functions, THRESHOLDS.functions)}  ${pct(p.functions)}`,
    `${statusIcon(p.branches, THRESHOLDS.branches)}   ${pct(p.branches)}`,
    `${statusIcon(p.statements, THRESHOLDS.statements)} ${pct(p.statements)}`,
    p.pass ? '✅ PASS' : '❌ FAIL'
  ])

  // Column widths
  const cols = header.length
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(header[i].length, ...rows.map((r) => r[i].length))
  )

  const separator = widths.map((w) => '-'.repeat(w + 2)).join('-+-')
  const formatRow = (row: string[]) =>
    '| ' + row.map((cell, i) => cell.padEnd(widths[i])).join(' | ') + ' |'

  console.log('\n📊  Per-package Coverage Report')
  console.log('='.repeat(separator.length + 4))
  console.log(formatRow(header))
  console.log('|-' + separator + '-|')
  for (const row of rows) console.log(formatRow(row))
  console.log('='.repeat(separator.length + 4))

  console.log('\nThresholds:')
  console.log(`  Lines      ≥ ${THRESHOLDS.lines}%`)
  console.log(`  Functions  ≥ ${THRESHOLDS.functions}%`)
  console.log(`  Branches   ≥ ${THRESHOLDS.branches}%`)
  console.log(`  Statements ≥ ${THRESHOLDS.statements}%`)
}

function buildMarkdownTable(packages: PackageCoverage[]): string {
  const lines: string[] = [
    '## 📊 Per-Package Coverage Report',
    '',
    '| Package | Lines | Functions | Branches | Statements | Status |',
    '|---------|-------|-----------|----------|------------|--------|'
  ]

  for (const p of packages) {
    lines.push(
      `| ${p.name} ` +
        `| ${statusIcon(p.lines, THRESHOLDS.lines)} ${pct(p.lines)} ` +
        `| ${statusIcon(p.functions, THRESHOLDS.functions)} ${pct(p.functions)} ` +
        `| ${statusIcon(p.branches, THRESHOLDS.branches)} ${pct(p.branches)} ` +
        `| ${statusIcon(p.statements, THRESHOLDS.statements)} ${pct(p.statements)} ` +
        `| ${p.pass ? '✅ PASS' : '❌ FAIL'} |`
    )
  }

  lines.push('')
  lines.push(
    `> Thresholds: lines ≥ ${THRESHOLDS.lines}%, functions ≥ ${THRESHOLDS.functions}%, branches ≥ ${THRESHOLDS.branches}%, statements ≥ ${THRESHOLDS.statements}%`
  )
  lines.push(`> Generated: ${new Date().toISOString()}`)

  return lines.join('\n')
}

function writeCombinedReport(packages: PackageCoverage[]): void {
  const outDir = path.join(ROOT, 'coverage')
  fs.mkdirSync(outDir, { recursive: true })

  // Machine-readable JSON
  const jsonPath = path.join(outDir, 'combined-summary.json')
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), thresholds: THRESHOLDS, packages },
      null,
      2
    ),
    'utf8'
  )
  console.log(`\n✔  Written: ${path.relative(ROOT, jsonPath)}`)

  // Markdown report
  const mdPath = path.join(outDir, 'combined-report.md')
  fs.writeFileSync(mdPath, buildMarkdownTable(packages), 'utf8')
  console.log(`✔  Written: ${path.relative(ROOT, mdPath)}`)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const { packages, anyFailed } = buildReport()
printTable(packages)
writeCombinedReport(packages)

if (anyFailed) {
  console.error('\n❌  One or more packages are below the coverage threshold.')
  process.exit(1)
} else {
  console.log('\n✅  All packages meet the coverage threshold.')
}
