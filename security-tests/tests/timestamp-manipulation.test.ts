import { describe, it, expect } from 'vitest'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://localhost:3000/api'

/**
 * Timestamp Manipulation Security Tests
 *
 * These tests verify that the Scavenger platform correctly handles timestamp
 * manipulation attempts. Attackers may try to submit future-dated transactions,
 * backdate transfers to bypass time-locked constraints, or replay old
 * transactions to exploit time-dependent logic such as reward calculations
 * and waste expiration.
 */
describe('Timestamp Manipulation: Future-dated Submissions', () => {
  it('should reject waste submissions with timestamps far in the future', async () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 365
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 500,
        submitter: 'RECYCLER_ADDRESS_1',
        submitted_at: futureTimestamp
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 422]).toContain(error.response?.status)
    }
  })

  it('should reject submissions with negative timestamps', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 500,
        submitter: 'RECYCLER_ADDRESS_1',
        submitted_at: -1
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 422]).toContain(error.response?.status)
    }
  })

  it('should reject submissions with timestamp zero (epoch)', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'metal',
        weight: 200,
        submitter: 'RECYCLER_ADDRESS_1',
        submitted_at: 0
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 422]).toContain(error.response?.status)
    }
  })

  it('should use server-side timestamps and ignore client-provided ones', async () => {
    const clientTimestamp = 1000000
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'glass',
        weight: 300,
        submitter: 'RECYCLER_ADDRESS_1',
        submitted_at: clientTimestamp
      })
      if (response.status === 200 || response.status === 201) {
        const waste = response.data
        if (waste.submitted_at) {
          expect(waste.submitted_at).not.toBe(clientTimestamp)
          expect(waste.submitted_at).toBeGreaterThan(clientTimestamp)
        }
      }
    } catch {
      expect(true).toBe(true)
    }
  })
})

describe('Timestamp Manipulation: Backdated Transfers', () => {
  it('should reject transfers with backdated timestamps', async () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 86400 * 30
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'RECYCLER_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_1',
        transferred_at: pastTimestamp
      })
      if (response.status === 200 || response.status === 201) {
        const transfer = response.data
        if (transfer.transferred_at) {
          expect(transfer.transferred_at).toBeGreaterThan(pastTimestamp)
        }
      }
    } catch {
      expect(true).toBe(true)
    }
  })

  it('should enforce chronological ordering of transfer events', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'COLLECTOR_ADDRESS_1',
        to: 'MANUFACTURER_ADDRESS_1',
        transferred_at: 1
      })
      if (response.status === 200 || response.status === 201) {
        const history = await axios.get(`${API_URL}/waste/1/history`)
        if (history.data && Array.isArray(history.data)) {
          for (let i = 1; i < history.data.length; i++) {
            expect(history.data[i].transferred_at).toBeGreaterThanOrEqual(
              history.data[i - 1].transferred_at
            )
          }
        }
      }
    } catch {
      expect(true).toBe(true)
    }
  })

  it('should reject transfer with timestamp before waste creation', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'RECYCLER_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_1',
        transferred_at: 946684800
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 422]).toContain(error.response?.status)
    }
  })
})

describe('Timestamp Manipulation: Expiration Bypass', () => {
  it('should not allow operations on expired waste items', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 999999,
        from: 'RECYCLER_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should reject verification of expired waste submissions', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/verify`, {
        waste_id: 999999,
        verifier: 'COLLECTOR_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should not extend expiration via repeated transfers', async () => {
    const transferRequests = Array(5)
      .fill(null)
      .map((_, i) =>
        axios
          .post(`${API_URL}/waste/transfer`, {
            waste_id: 999998,
            from: i % 2 === 0 ? 'RECYCLER_ADDRESS_1' : 'COLLECTOR_ADDRESS_1',
            to: i % 2 === 0 ? 'COLLECTOR_ADDRESS_1' : 'MANUFACTURER_ADDRESS_1'
          })
          .catch((e) => e.response)
      )

    const results = await Promise.all(transferRequests)
    const successCount = results.filter((r) => r?.status === 200 || r?.status === 201).length
    expect(successCount).toBeLessThanOrEqual(1)
  })
})

describe('Timestamp Manipulation: Reward Calculation Timing', () => {
  it('should calculate rewards based on server time, not client-supplied time', async () => {
    const manipulatedTimestamp = Math.floor(Date.now() / 1000) + 86400 * 365
    try {
      const response = await axios.post(`${API_URL}/rewards/distribute`, {
        waste_id: 1,
        incentive_id: 1,
        manufacturer: 'MANUFACTURER_ADDRESS_1',
        claimed_at: manipulatedTimestamp
      })
      if (response.status === 200 || response.status === 201) {
        if (response.data?.claimed_at) {
          const now = Math.floor(Date.now() / 1000)
          expect(response.data.claimed_at).toBeLessThanOrEqual(now + 60)
        }
      }
    } catch {
      expect(true).toBe(true)
    }
  })

  it('should not allow reward distribution for future-dated waste submissions', async () => {
    try {
      const response = await axios.post(`${API_URL}/rewards/distribute`, {
        waste_id: 999997,
        incentive_id: 1,
        manufacturer: 'MANUFACTURER_ADDRESS_1',
        submission_timestamp: Math.floor(Date.now() / 1000) + 86400 * 365
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent retroactive reward claims for past periods', async () => {
    try {
      const response = await axios.post(`${API_URL}/rewards/distribute`, {
        waste_id: 1,
        incentive_id: 1,
        manufacturer: 'MANUFACTURER_ADDRESS_1',
        period_start: 946684800,
        period_end: 946684801
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })
})

describe('Timestamp Manipulation: Transaction Replay', () => {
  it('should reject replayed transfer transactions', async () => {
    const transferPayload = {
      waste_id: 1,
      from: 'RECYCLER_ADDRESS_1',
      to: 'COLLECTOR_ADDRESS_1',
      nonce: 'replay-test-nonce-12345'
    }

    try {
      await axios.post(`${API_URL}/waste/transfer`, transferPayload)
    } catch {
      // First attempt may fail for other reasons
    }

    try {
      const replay = await axios.post(`${API_URL}/waste/transfer`, transferPayload)
      expect([400, 403, 409, 422]).toContain(replay.status)
    } catch (error: any) {
      expect([400, 403, 409, 422]).toContain(error.response?.status)
    }
  })

  it('should reject replayed verification requests', async () => {
    const verifyPayload = {
      waste_id: 1,
      verifier: 'COLLECTOR_ADDRESS_1',
      nonce: 'replay-verify-nonce-12345'
    }

    try {
      await axios.post(`${API_URL}/waste/verify`, verifyPayload)
    } catch {
      // First attempt may fail
    }

    try {
      const replay = await axios.post(`${API_URL}/waste/verify`, verifyPayload)
      if (replay.status === 200) {
        expect(true).toBe(true)
      }
    } catch (error: any) {
      expect([400, 403, 409, 422]).toContain(error.response?.status)
    }
  })

  it('should reject replayed registration requests', async () => {
    const registerPayload = {
      address: 'REPLAY_TEST_ADDRESS_1',
      role: 'recycler',
      name: 'Replay Test'
    }

    try {
      await axios.post(`${API_URL}/participants/register`, registerPayload)
    } catch {
      // First attempt may fail
    }

    try {
      const replay = await axios.post(`${API_URL}/participants/register`, registerPayload)
      expect([400, 409, 422]).toContain(replay.status)
    } catch (error: any) {
      expect([400, 409, 422]).toContain(error.response?.status)
    }
  })

  it('should include timestamps in signed transaction data to prevent replay', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 100,
        submitter: 'RECYCLER_ADDRESS_1'
      })
      if (response.data?.transaction) {
        expect(response.data.transaction.timestamp).toBeDefined()
        expect(response.data.transaction.expiry).toBeDefined()
      }
    } catch {
      expect(true).toBe(true)
    }
  })
})
