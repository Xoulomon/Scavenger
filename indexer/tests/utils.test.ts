/**
 * utils tests (#917)
 *
 * validators.ts and formatters.ts were removed in #917 — they exported helper
 * functions (isValidAddress, formatWeight, etc.) that were never called by any
 * production code in src/.  Their tests are removed here accordingly.
 *
 * The only remaining utility is the structured logger, which is tested by the
 * fact that it is imported and used successfully by 8 production modules.
 */

import { logger } from '../src/utils'

describe('logger', () => {
  let stdoutSpy: jest.SpyInstance
  let stderrSpy: jest.SpyInstance

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('writes info messages to stdout as JSON', () => {
    logger.info('test message', { key: 'value' })
    expect(stdoutSpy).toHaveBeenCalled()
    const written = stdoutSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(written)
    expect(parsed.level).toBe('INFO')
    expect(parsed.message).toBe('test message')
    expect(parsed.key).toBe('value')
    expect(parsed.service).toBe('indexer')
  })

  it('writes error messages to stderr', () => {
    logger.error('boom', { code: 500 })
    expect(stderrSpy).toHaveBeenCalled()
    const written = stderrSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(written)
    expect(parsed.level).toBe('ERROR')
    expect(parsed.message).toBe('boom')
    expect(parsed.code).toBe(500)
  })

  it('includes a timestamp in every log entry', () => {
    logger.info('ts-check')
    const written = stdoutSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(written)
    expect(parsed.timestamp).toBeDefined()
    expect(new Date(parsed.timestamp).getTime()).not.toBeNaN()
  })
})
