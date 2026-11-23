/**
 * getWastesWithTransfers loads transfers in one query, not one per waste (#1703).
 */

const mockQuery = jest.fn()

jest.mock('../src/db/client', () => ({
  getPool: () => ({ query: mockQuery })
}))
jest.mock('../src/db/queryOptimizer', () => ({
  recordQueryMetric: jest.fn()
}))

import { getWastesWithTransfers } from '../src/queries/optimizedQueries'

describe('getWastesWithTransfers (#1703)', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('issues exactly two queries regardless of how many wastes there are', async () => {
    const wastes = [1, 2, 3, 4, 5].map((id) => ({ id, recycler_address: 'R', is_active: true }))
    mockQuery.mockResolvedValueOnce({ rows: wastes }).mockResolvedValueOnce({
      rows: [{ id: 10, waste_id: 2, from_address: 'A', to_address: 'B', transferred_at: 'now' }]
    })

    const result = await getWastesWithTransfers('R')

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(5)
  })

  it('attaches each transfer to the waste it belongs to', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }).mockResolvedValueOnce({
      rows: [{ id: 10, waste_id: 2, from_address: 'A', to_address: 'B', transferred_at: 'now' }]
    })

    const result = await getWastesWithTransfers('R')

    expect(result.find((w) => w.id === 1)!.transfers).toEqual([])
    expect(result.find((w) => w.id === 2)!.transfers).toHaveLength(1)
  })

  it('returns an empty list without a second query when there are no wastes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await getWastesWithTransfers('R')

    expect(result).toEqual([])
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })
})
