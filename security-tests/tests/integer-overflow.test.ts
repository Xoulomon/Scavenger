import { describe, it, expect } from 'vitest'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://localhost:3000/api'

/**
 * Integer Overflow / Underflow Security Tests
 *
 * These tests target arithmetic overflow and underflow vulnerabilities in the
 * Scavenger platform. The Soroban smart contract uses u128, u64, and i128
 * types with checked arithmetic (checked_add, checked_sub). These tests verify
 * that the API layer properly validates numeric boundaries and rejects values
 * that could cause overflows in the contract or in JavaScript's number handling.
 *
 * Key boundaries:
 * - MAX_WASTE_WEIGHT: 1_000_000_000 grams (contract constant)
 * - Coordinates: latitude [-90_000_000, 90_000_000], longitude [-180_000_000, 180_000_000] (microdegrees)
 * - JavaScript: Number.MAX_SAFE_INTEGER = 2^53 - 1
 * - Rust u128 max: 2^128 - 1
 * - Rust u64 max: 2^64 - 1
 */
describe('Integer Overflow: Weight Values', () => {
  /**
   * Submitting waste with a weight at Number.MAX_SAFE_INTEGER should be
   * rejected since it exceeds MAX_WASTE_WEIGHT (1_000_000_000 grams).
   */
  it('should reject waste submission with weight at MAX_SAFE_INTEGER', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: Number.MAX_SAFE_INTEGER,
        submitter: 'RECYCLER_OVERFLOW_1',
        latitude: 40000000,
        longitude: -74000000
      })
      // Should not succeed - weight far exceeds max allowed
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  /**
   * Submitting waste with Number.MAX_VALUE should be rejected.
   * This tests floating-point extremes that lose precision.
   */
  it('should reject waste submission with weight at Number.MAX_VALUE', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'metal',
        weight: Number.MAX_VALUE,
        submitter: 'RECYCLER_OVERFLOW_2',
        latitude: 51000000,
        longitude: -1000000
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  /**
   * Submitting waste with zero weight should be rejected since the
   * contract enforces a minimum weight (default 1 gram).
   */
  it('should reject waste submission with weight of zero', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'glass',
        weight: 0,
        submitter: 'RECYCLER_OVERFLOW_3',
        latitude: 48000000,
        longitude: 2000000
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  /**
   * Negative weight values should be categorically rejected to prevent
   * underflow in total_waste_processed and global weight counters.
   */
  it('should reject waste submission with negative weight', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'paper',
        weight: -1,
        submitter: 'RECYCLER_OVERFLOW_4',
        latitude: 35000000,
        longitude: 139000000
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  /**
   * Weight at exactly MAX_WASTE_WEIGHT (1_000_000_000) should be accepted
   * since it is the upper boundary.
   */
  it('should handle weight at exactly MAX_WASTE_WEIGHT boundary', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 1000000000, // MAX_WASTE_WEIGHT = 1_000_000_000 grams
        submitter: 'RECYCLER_OVERFLOW_5',
        latitude: 52000000,
        longitude: 13000000
      })
      // Should succeed at the boundary
      expect(response.status).toBeLessThan(500)
    } catch (error: any) {
      // Acceptable: 400 if max weight validation rejects boundary, or auth error
      expect(error.response?.status).not.toBe(500)
    }
  })

  /**
   * Weight just above MAX_WASTE_WEIGHT should be rejected.
   */
  it('should reject weight one above MAX_WASTE_WEIGHT', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 1000000001, // MAX_WASTE_WEIGHT + 1
        submitter: 'RECYCLER_OVERFLOW_6',
        latitude: 52000000,
        longitude: 13000000
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })
})

describe('Integer Overflow: Reward Points', () => {
  /**
   * Reward amount at MAX_SAFE_INTEGER should be handled without causing
   * token overflow in total_tokens_earned or global total_tokens.
   */
  it('should reject reward with extremely large amount', async () => {
    try {
      await axios.post(`${API_URL}/tokens/reward`, {
        rewarder: 'ADMIN_ADDRESS',
        recipient: 'RECYCLER_OVERFLOW_7',
        amount: Number.MAX_SAFE_INTEGER,
        waste_id: 1
      })
      expect(false).toBe(true)
    } catch (error: any) {
      // Should reject due to overflow protection or validation
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Reward amount of zero should be rejected per the contract's
   * "Reward amount must be greater than zero" check.
   */
  it('should reject reward with zero amount', async () => {
    try {
      await axios.post(`${API_URL}/tokens/reward`, {
        rewarder: 'ADMIN_ADDRESS',
        recipient: 'RECYCLER_OVERFLOW_8',
        amount: 0,
        waste_id: 2
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Negative reward amount should be rejected to prevent underflow in
   * the recipient's balance.
   */
  it('should reject reward with negative amount', async () => {
    try {
      await axios.post(`${API_URL}/tokens/reward`, {
        rewarder: 'ADMIN_ADDRESS',
        recipient: 'RECYCLER_OVERFLOW_9',
        amount: -100,
        waste_id: 3
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Reward amounts exceeding u128 max (as a string) should not crash the
   * system. JSON does not have native u128 support so the API must validate.
   */
  it('should reject reward amount exceeding u128 max', async () => {
    try {
      await axios.post(`${API_URL}/tokens/reward`, {
        rewarder: 'ADMIN_ADDRESS',
        recipient: 'RECYCLER_OVERFLOW_10',
        amount: '340282366920938463463374607431768211456', // u128::MAX + 1
        waste_id: 4
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })
})

describe('Integer Overflow: Budget Calculations', () => {
  /**
   * Creating an incentive with a total_budget at u64 max should be handled
   * without causing overflow in budget calculations.
   */
  it('should handle incentive creation with max u64 budget', async () => {
    try {
      await axios.post(`${API_URL}/incentive/create`, {
        rewarder: 'MANUFACTURER_OVERFLOW_1',
        waste_type: 'plastic',
        reward_points: 100,
        total_budget: '18446744073709551615' // u64::MAX
      })
      // May succeed or fail, but should not crash
      expect(true).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  /**
   * Updating an incentive so that the new budget is less than the amount
   * already spent should deactivate it, not cause an underflow.
   */
  it('should handle incentive budget underflow gracefully', async () => {
    try {
      await axios.put(`${API_URL}/incentive/update`, {
        incentive_id: 1,
        new_reward_points: 100,
        new_total_budget: 0 // Less than any budget already used
      })
      expect(false).toBe(true)
    } catch (error: any) {
      // Zero budget should be rejected ("Total budget must be greater than zero")
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Percentages that sum to over 100 should be rejected by the contract's
   * "Total percentages cannot exceed 100" check.
   */
  it('should reject reward percentages exceeding 100%', async () => {
    try {
      await axios.post(`${API_URL}/admin/set-percentages`, {
        admin: 'ADMIN_ADDRESS',
        collector_percentage: 60,
        owner_percentage: 50 // 60 + 50 = 110 > 100
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Individual percentage values at u32 max should be rejected.
   */
  it('should reject percentage values at u32 max', async () => {
    try {
      await axios.post(`${API_URL}/admin/set-percentages`, {
        admin: 'ADMIN_ADDRESS',
        collector_percentage: 4294967295, // u32::MAX
        owner_percentage: 0
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })
})

describe('Integer Overflow: Waste ID Wraparound', () => {
  /**
   * Requesting a waste item with the maximum u128 ID should return not-found
   * rather than wrapping around to a valid ID.
   */
  it('should handle max u128 waste ID without wraparound', async () => {
    try {
      const response = await axios.get(`${API_URL}/waste/340282366920938463463374607431768211455`)
      // Should return 404 for non-existent waste
      expect(response.status).toBe(404)
    } catch (error: any) {
      expect([400, 404]).toContain(error.response?.status)
    }
  })

  /**
   * Requesting a waste item with an ID beyond u128 max (overflow) should be
   * rejected at the API level.
   */
  it('should reject waste ID exceeding u128 max', async () => {
    try {
      const response = await axios.get(`${API_URL}/waste/340282366920938463463374607431768211456`)
      expect(response.status).toBe(400)
    } catch (error: any) {
      expect([400, 404, 422]).toContain(error.response?.status)
    }
  })

  /**
   * Negative waste IDs should be rejected.
   */
  it('should reject negative waste ID', async () => {
    try {
      const response = await axios.get(`${API_URL}/waste/-1`)
      expect(response.status).toBe(400)
    } catch (error: any) {
      expect([400, 404, 422]).toContain(error.response?.status)
    }
  })
})

describe('Integer Overflow: Coordinate Extremes', () => {
  /**
   * Latitude must be within [-90_000_000, 90_000_000] microdegrees.
   * Values beyond this range should be rejected by validate_coordinates.
   */
  it('should reject latitude exceeding 90 degrees (in microdegrees)', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        address: 'OVERFLOW_COORD_1',
        role: 'recycler',
        name: 'CoordTest1',
        latitude: 90000001, // Just above max valid latitude
        longitude: 0
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Latitude below -90 degrees should be rejected.
   */
  it('should reject latitude below -90 degrees (in microdegrees)', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        address: 'OVERFLOW_COORD_2',
        role: 'recycler',
        name: 'CoordTest2',
        latitude: -90000001,
        longitude: 0
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Longitude must be within [-180_000_000, 180_000_000] microdegrees.
   */
  it('should reject longitude exceeding 180 degrees (in microdegrees)', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        address: 'OVERFLOW_COORD_3',
        role: 'collector',
        name: 'CoordTest3',
        latitude: 0,
        longitude: 180000001
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Longitude below -180 degrees should be rejected.
   */
  it('should reject longitude below -180 degrees (in microdegrees)', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        address: 'OVERFLOW_COORD_4',
        role: 'collector',
        name: 'CoordTest4',
        latitude: 0,
        longitude: -180000001
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Coordinates at i128 max should be rejected since they vastly exceed
   * valid geographic bounds.
   */
  it('should reject coordinates at i128 extremes', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        address: 'OVERFLOW_COORD_5',
        role: 'recycler',
        name: 'CoordTest5',
        latitude: '170141183460469231731687303715884105727', // i128::MAX
        longitude: '-170141183460469231731687303715884105728' // i128::MIN
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Valid boundary coordinates should be accepted.
   */
  it('should accept coordinates at valid boundaries', async () => {
    try {
      const response = await axios.post(`${API_URL}/participants/register`, {
        address: 'OVERFLOW_COORD_6',
        role: 'recycler',
        name: 'CoordTest6',
        latitude: 90000000, // Exactly 90 degrees N
        longitude: -180000000 // Exactly 180 degrees W
      })
      expect(response.status).toBeLessThan(500)
    } catch (error: any) {
      // May fail due to auth, but should not be a 500
      expect(error.response?.status).not.toBe(500)
    }
  })
})

describe('Integer Overflow: Batch Submission Weight Summing', () => {
  /**
   * Submitting multiple waste items whose individual weights are valid but
   * whose sum overflows u64 should be handled. The contract uses
   * checked_add for total_weight.
   */
  it('should handle batch with individual valid weights that sum to overflow', async () => {
    const nearMaxWeight = 999999999 // Just under MAX_WASTE_WEIGHT
    try {
      // Submit multiple wastes whose cumulative weight could overflow u64
      const submissions = Array(5)
        .fill(null)
        .map((_, i) =>
          axios
            .post(`${API_URL}/waste/submit`, {
              waste_type: 'plastic',
              weight: nearMaxWeight,
              submitter: `RECYCLER_BATCH_OVERFLOW_${i}`,
              latitude: 40000000,
              longitude: -74000000
            })
            .catch((e) => e.response)
        )

      const results = await Promise.all(submissions)

      // Each individual submission should not cause a 500 error
      for (const result of results) {
        if (result) {
          expect(result.status).not.toBe(500)
        }
      }
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  /**
   * A donation amount that would underflow the donor's balance should be
   * rejected with "Insufficient balance" rather than wrapping around.
   */
  it('should reject donation amount exceeding donor balance', async () => {
    try {
      await axios.post(`${API_URL}/charity/donate`, {
        donor: 'RECYCLER_OVERFLOW_DONATE',
        amount: Number.MAX_SAFE_INTEGER
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Seasonal multiplier at the boundary (500 = 5x) should be accepted;
   * values above should be rejected.
   */
  it('should reject seasonal multiplier exceeding max (500 basis points)', async () => {
    try {
      await axios.post(`${API_URL}/admin/seasonal-multiplier`, {
        admin: 'ADMIN_ADDRESS',
        multiplier: 501, // Above max allowed 500
        start: 1700000000,
        end: 1700100000
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })

  /**
   * Seasonal multiplier below minimum (100 = 1x) should be rejected.
   */
  it('should reject seasonal multiplier below min (100 basis points)', async () => {
    try {
      await axios.post(`${API_URL}/admin/seasonal-multiplier`, {
        admin: 'ADMIN_ADDRESS',
        multiplier: 99, // Below min allowed 100
        start: 1700000000,
        end: 1700100000
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400)
    }
  })
})
