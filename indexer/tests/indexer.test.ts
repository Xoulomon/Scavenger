import { PoolClient } from 'pg'
import { RawContractEvent } from '../src/types'
import {
  handleWasteRegistered,
  handleParticipantRegistered,
  handleWasteTransferred,
  handleWasteConfirmed,
  handleTokensRewarded,
  handleWasteDeactivated,
  handleWasteGraded,
  handleProcessingStatusChanged,
  handleWasteContaminated,
  handleAuctionCreated,
  handleAuctionEnded,
  handleCarbonCreditsEarned
} from '../src/handlers/eventHandlers'
import { dispatchEvent } from '../src/handlers/dispatcher'
import { processEvents } from '../src/indexer'
import { detectAndHandleReorg, rollbackFromLedger } from '../src/sync/syncStatus'

// --- Mock DB client ---
function makeMockClient(queryResults: Record<string, unknown[]> = {}) {
  const queries: Array<{ text: string; params: unknown[] }> = []

  const client = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      queries.push({ text, params: params ?? [] })
      const key = Object.keys(queryResults).find((k) => text.includes(k))
      return { rows: key ? queryResults[key] : [], rowCount: 0 }
    }),
    queries
  } as unknown as PoolClient & { queries: typeof queries }

  return client
}

function makeEvent(overrides: Partial<RawContractEvent> = {}): RawContractEvent {
  return {
    ledgerSequence: 100,
    ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
    transactionHash: 'abc123',
    contractId: 'CONTRACT_ID',
    eventType: 'recycled',
    topic: ['recycled', '42'],
    value: [0, '1000', 'GABC...', '40000000', '-74000000'],
    ...overrides
  }
}

// ===== Handler Tests =====

describe('handleWasteRegistered', () => {
  it('inserts waste with correct fields', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      topic: ['recycled', '42'],
      value: [2, '5000', 'GABC', '400', '-740']
    })
    await handleWasteRegistered(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO wastes'),
      expect.arrayContaining(['42', 'GABC', 'Plastic', '5000'])
    )
  })

  it('maps waste type number to string correctly', async () => {
    const client = makeMockClient()
    const event = makeEvent({ topic: ['recycled', '1'], value: [6, '100', 'GXYZ', '0', '0'] })
    await handleWasteRegistered(client, event)

    const call = (client.query as jest.Mock).mock.calls[0]
    expect(call[1]).toContain('Electronic')
  })

  it('defaults to Paper for unknown waste type', async () => {
    const client = makeMockClient()
    const event = makeEvent({ topic: ['recycled', '1'], value: [99, '100', 'GXYZ', '0', '0'] })
    await handleWasteRegistered(client, event)

    const call = (client.query as jest.Mock).mock.calls[0]
    expect(call[1]).toContain('Paper')
  })
})

describe('handleParticipantRegistered', () => {
  it('inserts participant with correct role', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'reg',
      topic: ['reg', 'GABC'],
      value: [1, 'Alice', '400', '-740']
    })
    await handleParticipantRegistered(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO participants'),
      expect.arrayContaining(['GABC', 'Collector', 'Alice'])
    )
  })

  it('maps role 2 to Manufacturer', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'reg',
      topic: ['reg', 'GDEF'],
      value: [2, 'Bob', '0', '0']
    })
    await handleParticipantRegistered(client, event)

    const call = (client.query as jest.Mock).mock.calls[0]
    expect(call[1]).toContain('Manufacturer')
  })
})

describe('handleWasteTransferred', () => {
  it('inserts transfer record', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'transfer',
      topic: ['transfer', '10'],
      value: ['GFROM', 'GTO']
    })
    await handleWasteTransferred(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO waste_transfers'),
      expect.arrayContaining(['10', 'GFROM', 'GTO'])
    )
  })
})

describe('handleWasteConfirmed', () => {
  it('updates waste confirmed flag', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'confirmed',
      topic: ['confirmed', '7'],
      value: 'GCONFIRMER'
    })
    await handleWasteConfirmed(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wastes SET is_confirmed = true'),
      expect.arrayContaining(['7'])
    )
  })
})

describe('handleTokensRewarded', () => {
  it('inserts token reward record', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'rewarded',
      topic: ['rewarded', 'GRECIP'],
      value: ['500', '3']
    })
    await handleTokensRewarded(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO token_rewards'),
      expect.arrayContaining(['GRECIP', '500', '3'])
    )
  })
})

describe('handleWasteDeactivated', () => {
  it('sets is_active to false', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'deactive',
      topic: ['deactive', '5'],
      value: ['GADMIN', 1000]
    })
    await handleWasteDeactivated(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wastes SET is_active = false'),
      ['5']
    )
  })
})

describe('handleWasteGraded', () => {
  it('updates waste grade', async () => {
    const client = makeMockClient()
    const event = makeEvent({ eventType: 'graded', topic: ['graded', '9'], value: [2, 'GGRADER'] })
    await handleWasteGraded(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wastes SET grade'),
      expect.arrayContaining(['9'])
    )
  })
})

describe('handleProcessingStatusChanged', () => {
  it('updates processing status', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'proc_upd',
      topic: ['proc_upd', '11'],
      value: ['GCALLER', 3, 9999]
    })
    await handleProcessingStatusChanged(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wastes SET processing_status'),
      expect.arrayContaining([3, '11'])
    )
  })
})

describe('handleWasteContaminated', () => {
  it('updates contamination level', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'contam',
      topic: ['contam', '13'],
      value: ['GVERIFIER', 2]
    })
    await handleWasteContaminated(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wastes SET contamination_level'),
      expect.arrayContaining([2, '13'])
    )
  })
})

describe('handleAuctionCreated', () => {
  it('inserts auction record', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'auc_cre',
      topic: ['auc_cre', '1'],
      value: ['50', 'GCREATOR', '1000', '9999999']
    })
    await handleAuctionCreated(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auctions'),
      expect.arrayContaining(['1', '50', 'GCREATOR', '1000'])
    )
  })
})

describe('handleAuctionEnded', () => {
  it('updates auction with winner and final price', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'auc_end',
      topic: ['auc_end', '1'],
      value: ['GWINNER', '2500']
    })
    await handleAuctionEnded(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auctions SET is_ended = true'),
      expect.arrayContaining(['GWINNER', '2500', '1'])
    )
  })

  it('handles null winner (no bids)', async () => {
    const client = makeMockClient()
    const event = makeEvent({ eventType: 'auc_end', topic: ['auc_end', '2'], value: [null, '0'] })
    await handleAuctionEnded(client, event)

    const call = (client.query as jest.Mock).mock.calls[0]
    expect(call[1][0]).toBeNull()
  })
})

describe('handleCarbonCreditsEarned', () => {
  it('inserts carbon credit record', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'carbon',
      topic: ['carbon', 'GPART'],
      value: [3, '2000', '40']
    })
    await handleCarbonCreditsEarned(client, event)

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO carbon_credits'),
      expect.arrayContaining(['GPART', 'Metal', '2000', '40'])
    )
  })
})

// ===== Dispatcher Tests =====

describe('dispatchEvent', () => {
  it('routes recycled event to waste handler', async () => {
    const client = makeMockClient()
    const event = makeEvent({
      eventType: 'recycled',
      topic: ['recycled', '1'],
      value: [0, '100', 'G', '0', '0']
    })
    await dispatchEvent(client, event)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO wastes'),
      expect.anything()
    )
  })

  it('ignores unknown event types without error', async () => {
    const client = makeMockClient()
    const event = makeEvent({ eventType: 'unknown_event' })
    await expect(dispatchEvent(client, event)).resolves.not.toThrow()
    expect(client.query).not.toHaveBeenCalled()
  })
})

// ===== Reorg Tests =====

describe('detectAndHandleReorg', () => {
  it('returns false when no reorg detected', async () => {
    const client = makeMockClient({ transaction_hash: [{ transaction_hash: 'abc123' }] })
    const result = await detectAndHandleReorg(client, 100, new Set(['abc123']))
    expect(result).toBe(false)
  })

  it('returns true and rolls back when reorg detected', async () => {
    const client = makeMockClient({ transaction_hash: [{ transaction_hash: 'old_hash' }] })
    const result = await detectAndHandleReorg(client, 100, new Set(['new_hash']))
    expect(result).toBe(true)
    // Should have called rollback queries
    const queryTexts = (client.query as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as string)
    expect(queryTexts.some((t) => t.includes('DELETE FROM raw_events'))).toBe(true)
  })
})

describe('rollbackFromLedger', () => {
  it('deletes all data from given ledger onwards', async () => {
    const client = makeMockClient()
    await rollbackFromLedger(client, 500)

    const queryTexts = (client.query as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as string)
    expect(queryTexts.some((t) => t.includes('DELETE FROM raw_events'))).toBe(true)
    expect(queryTexts.some((t) => t.includes('DELETE FROM wastes'))).toBe(true)
    expect(queryTexts.some((t) => t.includes('DELETE FROM participants'))).toBe(true)
    expect(queryTexts.some((t) => t.includes('UPDATE sync_status'))).toBe(true)
  })

  it('resets sync cursor to ledger - 1', async () => {
    const client = makeMockClient()
    await rollbackFromLedger(client, 500)

    const syncCall = (client.query as jest.Mock).mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('UPDATE sync_status')
    )
    expect(syncCall?.[1]).toEqual([499])
  })
})

// ===== processEvents integration =====

describe('processEvents', () => {
  it('returns early for empty event list', async () => {
    // Should not throw
    await expect(processEvents([])).resolves.not.toThrow()
  })
})
