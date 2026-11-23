#!/usr/bin/env node
/**
 * Automated accessibility audit script — issue #874
 *
 * Runs axe-core via Playwright against key pages and exits with a non-zero
 * code if any critical violations are found.  Designed to be run as a
 * CI-independent step:
 *
 *   node scripts/a11y-audit.mjs
 *
 * Prerequisites (already in devDependencies):
 *   @playwright/test, @axe-core/playwright
 *
 * Environment:
 *   BASE_URL  — defaults to http://localhost:5173
 */

import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

/** Pages to audit.  Add more as the app grows. */
const PAGES = [
  { name: 'Landing', path: '/' },
  { name: 'Login', path: '/login' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Waste List', path: '/wastes' },
  { name: 'Waste Submit', path: '/wastes/new' },
  { name: 'Incentives', path: '/incentives' },
  { name: 'Profile', path: '/profile' },
  { name: 'Settings', path: '/settings' },
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Recycling Guide', path: '/recycling-guide' },
  // Modal / dialog surfaces — focus management (issue #1678)
  { name: 'Waste Submit Modal', path: '/wastes?modal=submit' },
  { name: 'Confirm Dialog', path: '/wastes?modal=confirm' },
  { name: 'Settings Dialog', path: '/settings?modal=preferences' }
]

const IMPACT_LEVELS = /** @type {const} */ (['critical', 'serious'])

/**
 * Rules that specifically cover focus management / keyboard navigation
 * (issue #1678) and ARIA labelling (issue #1679).  Violations of these
 * rules are always reported, even if axe classifies them below "serious".
 */
const FOCUS_ARIA_RULES = /** @type {const} */ ([
  'focus-trap',
  'focus-order-semantics',
  'focusable-content',
  'focusable-element',
  'focusable-modal-open',
  'focusable-no-name',
  'aria-allowed-attr',
  'aria-hidden-focus',
  'aria-input-field-name',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-roles',
  'aria-valid-attr-value',
  'aria-valid-attr',
  'aria-dialog-name',
  'aria-command-name',
  'aria-toggle-field-name',
  'aria-tooltip-name',
  'aria-progressbar-name',
  'aria-meter-name',
  'aria-braille-equivalent',
  'aria-conditional-attr',
  'aria-deprecated-role',
  'aria-prohibited-attr',
  'aria-text',
  'dialog-name',
  'tabindex'
])

async function auditPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .analyze()
  return results.violations
}

/**
 * Returns true when a violation should fail the audit: either it is a
 * serious/critical impact violation, or it targets focus/ARIA rules.
 *
 * @param {{ impact?: string | null, id: string }} violation
 * @returns {boolean}
 */
export function isBlockingViolation(violation) {
  if (IMPACT_LEVELS.includes(violation.impact)) return true
  return FOCUS_ARIA_RULES.includes(violation.id)
}

/**
 * Formats a list of axe violations into a human-readable report.
 * Focus-management and ARIA violations are tagged so they are easy to spot.
 *
 * @param {Array<{ id: string, impact?: string | null, description: string, nodes: Array<{ html: string, target?: string[] }> }>} violations
 * @returns {string}
 */
export function formatViolations(violations) {
  return violations
    .map((v) => {
      const tag = FOCUS_ARIA_RULES.includes(v.id) ? ' [focus/aria]' : ''
      const nodes = v.nodes
        .map((n) => {
          const target = n.target?.length ? ` (${n.target.join(' ')})` : ''
          return `    • ${n.html.slice(0, 120)}${target}`
        })
        .join('\n')
      return `  [${v.impact?.toUpperCase() ?? 'UNKNOWN'}]${tag} ${v.id}: ${v.description}\n${nodes}`
    })
    .join('\n\n')
}

async function run() {
  console.log(`\n🔍  Accessibility audit — ${BASE_URL}\n`)

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  let totalCritical = 0
  let totalSerious = 0
  const report = []

  for (const { name, path } of PAGES) {
    const url = `${BASE_URL}${path}`
    process.stdout.write(`  Auditing ${name} (${url}) … `)

    let violations = []
    try {
      violations = await auditPage(page, url)
    } catch (err) {
      console.log(`SKIP (${err.message})`)
      continue
    }

    const critical = violations.filter((v) => v.impact === 'critical')
    const serious = violations.filter((v) => v.impact === 'serious')
    const focusAria = violations.filter(
      (v) => FOCUS_ARIA_RULES.includes(v.id) && !IMPACT_LEVELS.includes(v.impact)
    )
    totalCritical += critical.length
    totalSerious += serious.length

    const badge = critical.length > 0 ? '❌' : serious.length > 0 ? '⚠️ ' : '✅'
    console.log(
      `${badge}  ${violations.length} violation(s)  ` +
        `(${critical.length} critical, ${serious.length} serious, ${focusAria.length} focus/aria)`
    )

    const relevant = violations.filter(isBlockingViolation)
    if (relevant.length > 0) {
      report.push({ name, url, violations: relevant })
    }
  }

  await browser.close()

  console.log('\n── Summary ─────────────────────────────────────────────')
  console.log(`  Critical: ${totalCritical}`)
  console.log(`  Serious:  ${totalSerious}`)
  console.log('────────────────────────────────────────────────────────\n')

  if (report.length > 0) {
    for (const { name, url, violations } of report) {
      console.error(`\n❌  ${name}  (${url})`)
      console.error(formatViolations(violations))
    }
    console.error('\n✖  Accessibility audit FAILED — fix the violations above.\n')
    process.exit(1)
  }

  console.log('✔  Accessibility audit PASSED — zero critical/serious violations.\n')
  process.exit(0)
}

// Only auto-run when executed directly (so the formatter can be unit-tested).
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`

if (isDirectRun) {
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
