/**
 * Migrations run on the pool they are given, not the global one (#1704).
 */

const mockGetPool = jest.fn()

jest.mock('../src/db/client', () => ({
  getPool: () => mockGetPool()
}))

import { migrateUp } from '../src/db/migrate'

describe('migrateUp pool injection (#1704)', () => {
  beforeEach(() => {
    mockGetPool.mockReset()
  })

  it('uses the injected pool and never asks for the global pool', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) }

    await migrateUp(pool as never)

    expect(pool.query).toHaveBeenCalled()
    expect(mockGetPool).not.toHaveBeenCalled()
  })
})
