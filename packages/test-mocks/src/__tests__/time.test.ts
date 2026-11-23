import { describe, expect, it } from 'vitest'
import { installFakeClock, withFakeClock } from '../time'

describe('installFakeClock', () => {
  it('freezes Date.now() and new Date() at the given instant', () => {
    const clock = installFakeClock('2026-01-01T00:00:00Z')
    try {
      const expected = Date.parse('2026-01-01T00:00:00Z')
      expect(clock.now()).toBe(expected)
      expect(Date.now()).toBe(expected)
      expect(new Date().getTime()).toBe(expected)
      expect(new Date(Date.now()).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    } finally {
      clock.uninstall()
    }
  })

  it('advance() moves time forward by the given milliseconds', () => {
    const clock = installFakeClock(1_000_000)
    try {
      clock.advance(5_000)
      expect(Date.now()).toBe(1_005_000)
      clock.advance(-2_000)
      expect(Date.now()).toBe(1_003_000)
    } finally {
      clock.uninstall()
    }
  })

  it('set() jumps to an absolute instant', () => {
    const clock = installFakeClock(0)
    try {
      clock.set('2030-06-15T12:00:00Z')
      expect(Date.now()).toBe(Date.parse('2030-06-15T12:00:00Z'))
      clock.set(new Date('2000-01-01T00:00:00Z'))
      expect(Date.now()).toBe(Date.parse('2000-01-01T00:00:00Z'))
    } finally {
      clock.uninstall()
    }
  })

  it('keeps Date.parse, Date.UTC and instanceof working', () => {
    const clock = installFakeClock('2026-01-01T00:00:00Z')
    try {
      expect(Date.parse('2026-01-01T00:00:00Z')).toBe(Date.now())
      expect(Date.UTC(2026, 0, 1)).toBe(Date.now())
      expect(new Date() instanceof Date).toBe(true)
      expect(new Date('2020-05-05').getFullYear()).toBe(2020)
    } finally {
      clock.uninstall()
    }
  })

  it('uninstall() restores the real Date', () => {
    const before = Date.now()
    const clock = installFakeClock(42)
    expect(Date.now()).toBe(42)
    clock.uninstall()
    expect(Date.now()).toBeGreaterThanOrEqual(before)
    expect(Date.now()).not.toBe(42)
  })

  it('rejects double-install and invalid dates', () => {
    const clock = installFakeClock(0)
    try {
      expect(() => installFakeClock(1)).toThrow(/already installed/)
      expect(() => clock.set('not-a-date')).toThrow(/invalid date/)
    } finally {
      clock.uninstall()
    }
  })
})

describe('withFakeClock', () => {
  it('scopes the fake clock and always uninstalls', () => {
    const result = withFakeClock('2026-01-01T00:00:00Z', (clock) => {
      clock.advance(1_000)
      return Date.now()
    })
    expect(result).toBe(Date.parse('2026-01-01T00:00:00Z') + 1_000)
    expect(Date.now()).not.toBe(result)
  })

  it('uninstalls even when the callback throws', () => {
    expect(() =>
      withFakeClock(0, () => {
        throw new Error('boom')
      })
    ).toThrow('boom')
    const probe = installFakeClock(1)
    expect(Date.now()).toBe(1)
    probe.uninstall()
  })
})
