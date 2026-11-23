/**
 * Queue consumer/producer parity test (#795).
 *
 * Asserts that every job type with a producer also has a consumer, and
 * vice versa.  This prevents accumulation of dead consumers for retired
 * job types and ensures all enqueued jobs have a handler.
 */

import { PRODUCER_JOB_TYPES, CONSUMER_JOB_TYPES } from '../src/jobs'
import { JobQueue } from '../src/jobs/job-queue'

describe('Job queue parity (#795)', () => {
  // ── Static registry parity ────────────────────────────────────────────────

  it('every producer job type has a corresponding consumer', () => {
    const consumers = new Set(CONSUMER_JOB_TYPES)
    const unmatched = PRODUCER_JOB_TYPES.filter((t) => !consumers.has(t))
    expect(unmatched).toEqual([])
  })

  it('every consumer job type has a corresponding producer', () => {
    const producers = new Set(PRODUCER_JOB_TYPES)
    const unmatched = CONSUMER_JOB_TYPES.filter((t) => !producers.has(t))
    expect(unmatched).toEqual([])
  })

  it('no duplicate job types in PRODUCER_JOB_TYPES', () => {
    const unique = new Set(PRODUCER_JOB_TYPES)
    expect(unique.size).toBe(PRODUCER_JOB_TYPES.length)
  })

  it('no duplicate job types in CONSUMER_JOB_TYPES', () => {
    const unique = new Set(CONSUMER_JOB_TYPES)
    expect(unique.size).toBe(CONSUMER_JOB_TYPES.length)
  })

  // ── Runtime queue parity ─────────────────────────────────────────────────
  // Simulates a real queue setup: register processors for all consumer
  // types and then verify that the registered set matches the producer set.

  it('registered processors match PRODUCER_JOB_TYPES at runtime', () => {
    // Build a queue and register a no-op processor for every consumer type
    const mockClient = {
      zadd: jest.fn(),
      zrange: jest.fn(),
      zrem: jest.fn(),
      zcard: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn()
    }

    const queue = new JobQueue(mockClient as any)
    for (const jobType of CONSUMER_JOB_TYPES) {
      queue.registerProcessor(jobType, async () => {})
    }

    const registered = new Set(queue.getRegisteredJobTypes())
    const producers = new Set(PRODUCER_JOB_TYPES)

    // Every producer must have a processor
    for (const t of producers) {
      expect(registered.has(t)).toBe(true)
    }

    // No extra processors beyond what producers define
    for (const t of registered) {
      expect(producers.has(t)).toBe(true)
    }
  })

  // ── Catch dead consumers ──────────────────────────────────────────────────

  it('detects a dead consumer (consumer without producer) – regression guard', () => {
    // Simulates what happens when a job type is removed from producers
    // but its consumer is accidentally left in the consumer list.
    const producers = new Set(['event-sync', 'ledger-replay'])
    const consumers = ['event-sync', 'ledger-replay', 'retired-job'] // 'retired-job' is dead

    const deadConsumers = consumers.filter((t) => !producers.has(t))
    // This is the check that the parity test enforces
    // We verify the detection logic works correctly
    expect(deadConsumers).toEqual(['retired-job'])
  })

  it('detects an orphaned producer (producer without consumer) – regression guard', () => {
    const consumers = new Set(['event-sync'])
    const producers = ['event-sync', 'new-job-without-handler']

    const orphaned = producers.filter((t) => !consumers.has(t))
    expect(orphaned).toEqual(['new-job-without-handler'])
  })
})
