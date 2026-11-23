import { injectAxe, checkA11y } from 'axe-playwright'

/**
 * Accessibility audit configuration (WCAG 2.1 AA).
 *
 * Covers the rules required by issues #1678 (focus management / focus traps),
 * #1679 (ARIA labels and roles) and #1680 (color contrast).
 *
 * How to run the audit:
 *   - Unit tests: `npm test` (see `frontend/a11y.config.test.ts`)
 *   - E2E audit:  `npm run test:a11y` (Playwright + axe-playwright)
 *
 * CI gating:
 *   - `runA11yCheck` fails the test run when axe reports any violation with
 *     impact `serious` or `critical`. Lower-impact violations are reported but
 *     do not fail the build.
 *   - The rules below are explicitly enabled so that regressions in focus
 *     management, ARIA usage and color contrast are caught even if axe's
 *     default rule set changes between versions.
 *
 * Backwards compatibility:
 *   - The exported `a11yConfig` object keeps its existing shape
 *     (`{ rules: { [ruleId]: { enabled: boolean } } }`); only new rules were
 *     added, so existing callers continue to work unchanged.
 *   - `runA11yCheck(page, context?)` keeps its signature. An optional third
 *     argument (`options`) was added for advanced callers; omitting it
 *     preserves the previous behaviour.
 */

/** Axe impact levels that should fail CI. */
export const BLOCKING_IMPACTS = ['serious', 'critical'] as const

export type BlockingImpact = (typeof BLOCKING_IMPACTS)[number]

export const a11yConfig = {
  rules: {
    // Color contrast (WCAG 1.4.3 / #1680)
    'color-contrast': { enabled: true },

    // Images and names (WCAG 1.1.1 / 2.4.4 / 4.1.2)
    'image-alt': { enabled: true },
    label: { enabled: true },
    'button-name': { enabled: true },
    'link-name': { enabled: true },

    // ARIA attributes and roles (WCAG 4.1.2 / #1679)
    'aria-required-attr': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-dialog-name': { enabled: true },
    'nested-interactive': { enabled: true },

    // Focus management / focus traps (WCAG 2.1.2 / 2.4.3 / #1678)
    'focus-trap': { enabled: true },
    'focus-order-semantics': { enabled: true },
    tabindex: { enabled: true },

    // Forms and structure (WCAG 1.3.1 / 2.4.6)
    'form-field-multiple-labels': { enabled: true },
    'heading-order': { enabled: true },
    list: { enabled: true }
  }
}

export interface RunA11yCheckOptions {
  /** Optional selector scoping the audit to a subtree. */
  context?: string
  /** Impact levels that should fail the run. Defaults to serious + critical. */
  blockingImpacts?: readonly BlockingImpact[]
  /** Extra axe options merged over the defaults. */
  axeOptions?: Record<string, unknown>
}

/**
 * Runs an axe audit against the given page.
 *
 * Throws when any violation with a blocking impact (default: `serious` or
 * `critical`) is found, so CI fails on regressions.
 *
 * @param page    Playwright page instance.
 * @param context Optional selector scoping the audit (backwards compatible
 *                with the previous `runA11yCheck(page, context)` signature).
 * @param options Optional advanced options.
 */
export async function runA11yCheck(page: any, context?: string, options: RunA11yCheckOptions = {}) {
  const blockingImpacts = options.blockingImpacts ?? BLOCKING_IMPACTS

  await injectAxe(page)
  await checkA11y(page, context, {
    detailedReport: true,
    detailedReportOptions: {
      html: true
    },
    axeOptions: {
      rules: a11yConfig.rules,
      ...(options.axeOptions ?? {})
    },
    // Fail the run only on serious/critical violations.
    includedImpacts: [...blockingImpacts]
  })
}

/**
 * Returns the list of rule ids that must be enabled for the WCAG 2.1 AA audit.
 * Useful for tests and for keeping documentation in sync.
 */
export function getRequiredRuleIds(): string[] {
  return Object.keys(a11yConfig.rules)
}
