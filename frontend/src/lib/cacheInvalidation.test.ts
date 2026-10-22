import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { cacheKeys } from './cacheKeys'
import { invalidateKeys, invalidationPlan } from './cacheInvalidation'

const seed = (qc: QueryClient, keys: readonly (readonly unknown[])[]) =>
  keys.forEach((k) => qc.setQueryData(k, { seeded: true }))

const invalidatedAfter = async (
  qc: QueryClient,
  seeded: readonly (readonly unknown[])[],
  keys: readonly (readonly unknown[])[]
) => {
  await invalidateKeys(qc, keys)
  return seeded.filter((k) => qc.getQueryState(k)?.isInvalidated)
}

describe('invalidationPlan', () => {
  it('transferWaste invalidates participant wastes and that waste’s transfer history', async () => {
    const qc = new QueryClient()
    const seeded = [
      cacheKeys.participantWastes('GA'),
      cacheKeys.transferHistory('5'),
      cacheKeys.transferHistory('6'),
      cacheKeys.waste('5'),
    ]
    seed(qc, seeded)

    const hit = await invalidatedAfter(qc, seeded, invalidationPlan.transferWaste('5'))

    expect(hit).toEqual([cacheKeys.participantWastes('GA'), cacheKeys.transferHistory('5')])
  })

  it('confirmWaste invalidates participant wastes and the confirmed waste only', async () => {
    const qc = new QueryClient()
    const seeded = [
      cacheKeys.participantWastes('GA'),
      cacheKeys.waste('9'),
      cacheKeys.waste('10'),
      cacheKeys.rewards('GA'),
    ]
    seed(qc, seeded)

    const hit = await invalidatedAfter(qc, seeded, invalidationPlan.confirmWaste('9'))

    expect(hit).toEqual([cacheKeys.participantWastes('GA'), cacheKeys.waste('9')])
  })

  it('distributeRewards invalidates rewards, participant stats and supply chain stats', async () => {
    const qc = new QueryClient()
    const seeded = [
      cacheKeys.rewards('GA'),
      cacheKeys.participantStats('GA'),
      cacheKeys.supplyChainStats(),
      cacheKeys.metrics(),
    ]
    seed(qc, seeded)

    const hit = await invalidatedAfter(qc, seeded, invalidationPlan.distributeRewards())

    expect(hit).toEqual([
      cacheKeys.rewards('GA'),
      cacheKeys.participantStats('GA'),
      cacheKeys.supplyChainStats(),
    ])
  })

  it('recycleWaste only invalidates the recycler’s wastes', async () => {
    const qc = new QueryClient()
    const seeded = [cacheKeys.participantWastes('GA'), cacheKeys.participantWastes('GB')]
    seed(qc, seeded)

    const hit = await invalidatedAfter(qc, seeded, invalidationPlan.recycleWaste('GA'))

    expect(hit).toEqual([cacheKeys.participantWastes('GA')])
  })

  it('claimIncentive invalidates every incentives query', async () => {
    const qc = new QueryClient()
    const seeded = [cacheKeys.incentives(), cacheKeys.incentives('Plastic'), cacheKeys.activeIncentives()]
    seed(qc, seeded)

    const hit = await invalidatedAfter(qc, seeded, invalidationPlan.claimIncentive())

    expect(hit).toHaveLength(3)
  })
})
