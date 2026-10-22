import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { cacheKeys } from './cacheKeys'

describe('cacheKeys', () => {
  it('builds full keys when arguments are given', () => {
    expect(cacheKeys.participant('GABC')).toEqual(['participant', 'GABC'])
    expect(cacheKeys.waste('7')).toEqual(['waste', '7'])
    expect(cacheKeys.rewards('GABC')).toEqual(['rewards', 'GABC'])
  })

  it('drops trailing undefined parts so a no-argument call is a prefix key', () => {
    expect(cacheKeys.participantWastes()).toEqual(['participant-wastes'])
    expect(cacheKeys.participantWastes('GABC')).toEqual(['participant-wastes', 'GABC'])
    expect(cacheKeys.transferHistory()).toEqual(['transfer-history'])
  })

  it('keeps the same stats key for query and invalidation sites', () => {
    expect(cacheKeys.participantStats('GABC')).toEqual(['participant-stats', 'GABC'])
  })

  it('defaults incentives to the "all" segment', () => {
    expect(cacheKeys.incentives()).toEqual(['incentives', 'all'])
    expect(cacheKeys.incentives('Plastic')).toEqual(['incentives', 'Plastic'])
    expect(cacheKeys.incentivesRoot()).toEqual(['incentives'])
  })

  it('matches every entry of a resource when invalidated by its prefix key', async () => {
    const qc = new QueryClient()
    qc.setQueryData(cacheKeys.participantWastes('GA'), [1])
    qc.setQueryData(cacheKeys.participantWastes('GB'), [2])
    qc.setQueryData(cacheKeys.waste('1'), { id: 1 })

    await qc.invalidateQueries({ queryKey: cacheKeys.participantWastes() })

    expect(qc.getQueryState(cacheKeys.participantWastes('GA'))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(cacheKeys.participantWastes('GB'))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(cacheKeys.waste('1'))?.isInvalidated).toBe(false)
  })
})
