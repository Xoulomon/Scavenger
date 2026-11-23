/**
 * jobTypes.ts – canonical registry of all job types used by the indexer.
 *
 * Every job type that is enqueued (producer) MUST also have a registered
 * processor (consumer), and vice versa.  This file is the single source of
 * truth checked by the parity test.
 */

/** All job types that have at least one producer (enqueue call). */
export const PRODUCER_JOB_TYPES: readonly string[] = [
  'event-sync',
  'ledger-replay',
  'alert-check'
] as const

/** All job types that have a registered processor (consumer). */
export const CONSUMER_JOB_TYPES: readonly string[] = [
  'event-sync',
  'ledger-replay',
  'alert-check'
] as const
