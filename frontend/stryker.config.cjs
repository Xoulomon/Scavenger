/**
 * #964 – Stryker mutation testing configuration
 *
 * Targets the two highest-value critical modules:
 *   1. src/lib/wallet.ts      – Freighter wallet integration (connect, sign)
 *   2. src/api/client.ts      – Soroban contract client (invoke, error handling)
 *
 * Run locally:
 *   npx stryker run
 *
 * Run for CI (fast, bail on score < threshold):
 *   npx stryker run --reporters clear-text,progress,dashboard
 *
 * Mutation score is written to:
 *   reports/mutation/mutation.json   (machine-readable, for CI parsing)
 *   reports/mutation/index.html      (human-readable HTML report)
 *
 * Minimum accepted score: 70 % (logged in mutation-score.md after each run)
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
module.exports = {
  // ── Runner ──────────────────────────────────────────────────────────────────
  // Re-use the project's existing Vitest setup so mocks, aliases and setup
  // files are available during mutation testing without extra configuration.
  testRunner: 'vitest',
  vitest: {
    // Use the existing vite.config.ts; Stryker will pick up the `test` block.
    configFile: 'vite.config.ts',
  },

  // ── Scope ───────────────────────────────────────────────────────────────────
  // Mutate the critical modules. Narrowing the scope keeps each mutation run
  // under 5 minutes on a dev laptop.
  mutate: [
    'src/lib/wallet.ts',
    'src/api/client.ts',
    'src/lib/validation/wasteSubmission.ts',
    'src/features/transfers/service.ts',
    'src/features/transfers/schemas.ts',
  ],

  // ── Mutators ────────────────────────────────────────────────────────────────
  // Use the full default set; comment-out specific operators if false-positives
  // emerge after the first baseline run.
  mutator: {
    plugins: ['@stryker-mutator/typescript-checker'],
    // Exclude patterns that generate noise without value:
    //   - string literals in error messages (covered by integration tests)
    //   - constant initial-state objects
    excludedMutations: [
      'StringLiteralMutation',
      'ObjectLiteralMutation',
    ],
  },

  // ── TypeScript checking ──────────────────────────────────────────────────────
  // Reject type-incorrect mutants early so they don't waste runner time.
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',

  // ── Concurrency ─────────────────────────────────────────────────────────────
  // Default: number of logical CPUs / 2.  Reduce on CI if resource-constrained.
  concurrency: process.env.CI ? 2 : 4,

  // ── Thresholds ───────────────────────────────────────────────────────────────
  // CI fails when the mutation score drops below `break`.
  // `low` and `high` control the coloured HTML badge.
  thresholds: {
    high: 80,
    low: 75,
    break: 80,
  },

  // ── Reporters ────────────────────────────────────────────────────────────────
  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },

  // ── Misc ─────────────────────────────────────────────────────────────────────
  // Prevent runaway tests from hanging the mutation run.
  timeoutMS: 30_000,
  timeoutFactor: 2.5,

  // Only show coverage for mutated files to keep output concise.
  coverageAnalysis: 'perTest',
};
