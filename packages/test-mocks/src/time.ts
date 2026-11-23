/**
 * Deterministic time/clock mocking for tests (issue #1766).
 *
 * Patches the global `Date` so `Date.now()` and `new Date()` return a
 * controlled instant. Framework-agnostic: works under vitest, jest, or plain
 * node:test without depending on fake-timer APIs.
 *
 * Usage:
 *   const clock = installFakeClock('2026-01-01T00:00:00Z')
 *   ... code under test reads Date.now() ...
 *   clock.advance(5_000)
 *   clock.uninstall()
 *
 * Or scoped:
 *   withFakeClock('2026-01-01T00:00:00Z', (clock) => { ... })
 */

export interface FakeClock {
  /** Current mocked epoch milliseconds. */
  now(): number
  /** Move the mocked clock forward (or backward, with negative ms). */
  advance(ms: number): void
  /** Jump the mocked clock to an absolute instant. */
  set(value: string | number | Date): void
  /** Restore the real global Date. Always call in afterEach/finally. */
  uninstall(): void
}

let activeClock: FakeClock | null = null

function toEpochMs(value: string | number | Date): number {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) throw new Error(`installFakeClock: invalid date "${value}"`)
  return parsed
}

/**
 * Install a fake global Date starting at `initial` (default: current time).
 * Throws if a clock is already installed — uninstall the previous one first.
 */
export function installFakeClock(initial: string | number | Date = Date.now()): FakeClock {
  if (activeClock) {
    throw new Error('installFakeClock: a fake clock is already installed — call uninstall() first')
  }

  const RealDate = Date
  let current = toEpochMs(initial)

  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(current)
      } else {
        // forward the original arguments (value | year/month/day form)
        super(...(args as [value: number | string]))
      }
    }

    static now(): number {
      return current
    }
  }

  const globalRef = globalThis as { Date: typeof Date }
  const realDate = globalRef.Date
  globalRef.Date = FakeDate as unknown as typeof Date

  activeClock = {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
    set: (value: string | number | Date) => {
      current = toEpochMs(value)
    },
    uninstall: () => {
      globalRef.Date = realDate
      activeClock = null
    },
  }
  return activeClock
}

/** Run `fn` with a fake clock installed; always uninstalls afterwards. */
export function withFakeClock<T>(
  initial: string | number | Date,
  fn: (clock: FakeClock) => T
): T {
  const clock = installFakeClock(initial)
  try {
    return fn(clock)
  } finally {
    clock.uninstall()
  }
}
