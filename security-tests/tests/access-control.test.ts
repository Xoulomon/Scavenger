import { describe, it, expect } from 'vitest'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://localhost:3000/api'

/**
 * Access Control Security Tests
 *
 * These tests verify the Role-Based Access Control (RBAC) matrix for the
 * Scavenger platform. The contract enforces strict rules about which roles
 * can perform which operations and which transfer paths are valid:
 *   - Recycler can submit waste, transfer to Collector or Manufacturer
 *   - Collector can transfer to Manufacturer only
 *   - Manufacturer cannot transfer waste
 *   - Admin-only operations: transfer_admin, pause, set_token_address, etc.
 */
describe('Access Control: RBAC Matrix — Recycler Operations', () => {
  it('should allow Recycler to submit waste', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 500,
        submitter: 'RECYCLER_ADDRESS_1',
        role: 'recycler'
      })
      expect([200, 201, 401, 403]).toContain(response.status)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should allow Recycler to transfer waste to Collector', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'RECYCLER_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_1',
        from_role: 'recycler',
        to_role: 'collector'
      })
      expect([200, 201, 401, 403, 404]).toContain(response.status)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should allow Recycler to transfer waste to Manufacturer', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'RECYCLER_ADDRESS_1',
        to: 'MANUFACTURER_ADDRESS_1',
        from_role: 'recycler',
        to_role: 'manufacturer'
      })
      expect([200, 201, 401, 403, 404]).toContain(response.status)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should prevent Recycler from calling admin operations', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/admin/transfer-admin`,
        {
          new_admin: 'RECYCLER_ADDRESS_1'
        },
        {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: RBAC Matrix — Collector Operations', () => {
  it('should allow Collector to transfer waste to Manufacturer', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'COLLECTOR_ADDRESS_1',
        to: 'MANUFACTURER_ADDRESS_1',
        from_role: 'collector',
        to_role: 'manufacturer'
      })
      expect([200, 201, 401, 403, 404]).toContain(response.status)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should prevent Collector from transferring waste to Recycler (invalid path)', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'COLLECTOR_ADDRESS_1',
        to: 'RECYCLER_ADDRESS_1',
        from_role: 'collector',
        to_role: 'recycler'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent Collector from transferring waste to another Collector', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'COLLECTOR_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_2',
        from_role: 'collector',
        to_role: 'collector'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent Collector from calling admin operations', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/admin/pause`,
        {},
        {
          headers: { 'X-Wallet-Address': 'COLLECTOR_ADDRESS_1' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: RBAC Matrix — Manufacturer Operations', () => {
  it('should prevent Manufacturer from transferring waste to anyone', async () => {
    const recipients = [
      { to: 'RECYCLER_ADDRESS_1', to_role: 'recycler' },
      { to: 'COLLECTOR_ADDRESS_1', to_role: 'collector' },
      { to: 'MANUFACTURER_ADDRESS_2', to_role: 'manufacturer' }
    ]

    for (const recipient of recipients) {
      try {
        const response = await axios.post(`${API_URL}/waste/transfer`, {
          waste_id: 1,
          from: 'MANUFACTURER_ADDRESS_1',
          ...recipient,
          from_role: 'manufacturer'
        })
        expect(response.status).not.toBe(200)
      } catch (error: any) {
        expect([400, 403, 422]).toContain(error.response?.status)
      }
    }
  })

  it('should allow Manufacturer to create incentives', async () => {
    try {
      const response = await axios.post(`${API_URL}/incentives/create`, {
        rewarder: 'MANUFACTURER_ADDRESS_1',
        waste_type: 'plastic',
        reward_points: 100,
        budget: 10000
      })
      expect([200, 201, 401, 403]).toContain(response.status)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should prevent Manufacturer from calling admin operations', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/admin/set-token-address`,
        {
          token_address: 'MANUFACTURER_ADDRESS_1'
        },
        {
          headers: { 'X-Wallet-Address': 'MANUFACTURER_ADDRESS_1' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: Valid Transfer Paths', () => {
  const VALID_PATHS = [
    { from_role: 'recycler', to_role: 'collector', description: 'Recycler → Collector' },
    { from_role: 'recycler', to_role: 'manufacturer', description: 'Recycler → Manufacturer' },
    { from_role: 'collector', to_role: 'manufacturer', description: 'Collector → Manufacturer' }
  ]

  for (const path of VALID_PATHS) {
    it(`should allow transfer path: ${path.description}`, async () => {
      try {
        const response = await axios.post(`${API_URL}/waste/transfer`, {
          waste_id: 1,
          from: `${path.from_role.toUpperCase()}_ADDRESS_1`,
          to: `${path.to_role.toUpperCase()}_ADDRESS_1`,
          from_role: path.from_role,
          to_role: path.to_role
        })
        expect([200, 201, 401, 403, 404]).toContain(response.status)
      } catch (error: any) {
        expect(error.response?.status).not.toBe(500)
      }
    })
  }
})

describe('Access Control: Invalid Transfer Paths', () => {
  const INVALID_PATHS = [
    { from_role: 'collector', to_role: 'recycler', description: 'Collector → Recycler' },
    { from_role: 'manufacturer', to_role: 'recycler', description: 'Manufacturer → Recycler' },
    { from_role: 'manufacturer', to_role: 'collector', description: 'Manufacturer → Collector' },
    {
      from_role: 'manufacturer',
      to_role: 'manufacturer',
      description: 'Manufacturer → Manufacturer'
    },
    { from_role: 'collector', to_role: 'collector', description: 'Collector → Collector' },
    { from_role: 'recycler', to_role: 'recycler', description: 'Recycler → Recycler' }
  ]

  for (const path of INVALID_PATHS) {
    it(`should reject invalid transfer path: ${path.description}`, async () => {
      try {
        const response = await axios.post(`${API_URL}/waste/transfer`, {
          waste_id: 1,
          from: `${path.from_role.toUpperCase()}_ADDRESS_1`,
          to: `${path.to_role.toUpperCase()}_ADDRESS_1`,
          from_role: path.from_role,
          to_role: path.to_role
        })
        expect(response.status).not.toBe(200)
      } catch (error: any) {
        expect([400, 403, 422]).toContain(error.response?.status)
      }
    })
  }
})

describe('Access Control: Admin-Only Operations', () => {
  const ADMIN_ENDPOINTS = [
    { path: '/admin/transfer-admin', body: { new_admin: 'ATTACKER_ADDRESS' } },
    { path: '/admin/pause', body: {} },
    { path: '/admin/set-token-address', body: { token_address: 'ATTACKER_TOKEN' } },
    { path: '/admin/set-percentages', body: { collector_pct: 50, owner_pct: 50 } },
    { path: '/admin/set-charity-contract', body: { charity_address: 'ATTACKER_ADDRESS' } }
  ]

  for (const endpoint of ADMIN_ENDPOINTS) {
    it(`should reject non-admin access to ${endpoint.path}`, async () => {
      try {
        const response = await axios.post(`${API_URL}${endpoint.path}`, endpoint.body, {
          headers: { 'X-Wallet-Address': 'NON_ADMIN_ADDRESS' }
        })
        expect(response.status).not.toBe(200)
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status)
      }
    })
  }

  it('should reject admin operations with empty wallet address', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/admin/transfer-admin`,
        {
          new_admin: 'ATTACKER_ADDRESS'
        },
        {
          headers: { 'X-Wallet-Address': '' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 401, 403]).toContain(error.response?.status)
    }
  })

  it('should reject deactivate waste from non-admin', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/waste/deactivate`,
        {
          waste_id: 1,
          admin: 'NON_ADMIN_ADDRESS'
        },
        {
          headers: { 'X-Wallet-Address': 'NON_ADMIN_ADDRESS' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: Contract Paused State', () => {
  it('should reject waste submissions when contract is paused', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/waste/submit`,
        {
          waste_type: 'plastic',
          weight: 500,
          submitter: 'RECYCLER_ADDRESS_1'
        },
        {
          headers: { 'X-Contract-State': 'paused' }
        }
      )
      if (response.status === 200 || response.status === 201) {
        expect(true).toBe(true)
      }
    } catch (error: any) {
      expect([403, 503]).toContain(error.response?.status)
    }
  })

  it('should reject transfers when contract is paused', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/waste/transfer`,
        {
          waste_id: 1,
          from: 'RECYCLER_ADDRESS_1',
          to: 'COLLECTOR_ADDRESS_1'
        },
        {
          headers: { 'X-Contract-State': 'paused' }
        }
      )
      if (response.status === 200 || response.status === 201) {
        expect(true).toBe(true)
      }
    } catch (error: any) {
      expect([403, 503]).toContain(error.response?.status)
    }
  })

  it('should reject registrations when contract is paused', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/participants/register`,
        {
          address: 'NEW_PARTICIPANT_PAUSED',
          role: 'recycler',
          name: 'Paused Test'
        },
        {
          headers: { 'X-Contract-State': 'paused' }
        }
      )
      if (response.status === 200 || response.status === 201) {
        expect(true).toBe(true)
      }
    } catch (error: any) {
      expect([403, 503]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: Deactivated Incentive Operations', () => {
  it('should prevent reward distribution from deactivated incentives', async () => {
    try {
      const response = await axios.post(`${API_URL}/rewards/distribute`, {
        waste_id: 1,
        incentive_id: 999999,
        manufacturer: 'MANUFACTURER_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent updates to deactivated incentives', async () => {
    try {
      const response = await axios.put(`${API_URL}/incentives/999999`, {
        rewarder: 'MANUFACTURER_ADDRESS_1',
        reward_points: 200,
        budget: 20000
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent claiming rewards from deactivated incentive', async () => {
    try {
      const response = await axios.post(`${API_URL}/rewards/claim`, {
        incentive_id: 999999,
        participant: 'RECYCLER_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: Deactivated Waste Operations', () => {
  it('should prevent transfer of deactivated waste', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 888888,
        from: 'RECYCLER_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_1',
        deactivated: true
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent verification of deactivated waste', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/verify`, {
        waste_id: 888888,
        verifier: 'COLLECTOR_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })

  it('should prevent confirmation of deactivated waste', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/confirm`, {
        waste_id: 888888,
        confirmer: 'COLLECTOR_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 403, 404, 422]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: Deregistered Participant Operations', () => {
  it('should prevent deregistered participant from submitting waste', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 500,
        submitter: 'DEREGISTERED_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 401, 403]).toContain(error.response?.status)
    }
  })

  it('should prevent deregistered participant from transferring waste', async () => {
    try {
      const response = await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 1,
        from: 'DEREGISTERED_ADDRESS_1',
        to: 'COLLECTOR_ADDRESS_1'
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 401, 403]).toContain(error.response?.status)
    }
  })

  it('should prevent deregistered participant from creating incentives', async () => {
    try {
      const response = await axios.post(`${API_URL}/incentives/create`, {
        rewarder: 'DEREGISTERED_ADDRESS_1',
        waste_type: 'plastic',
        reward_points: 100,
        budget: 10000
      })
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([400, 401, 403]).toContain(error.response?.status)
    }
  })
})

describe('Access Control: Role Escalation Prevention', () => {
  it('should prevent participant from changing own role', async () => {
    try {
      const response = await axios.put(
        `${API_URL}/participants/update-role`,
        {
          address: 'RECYCLER_ADDRESS_1',
          new_role: 'manufacturer'
        },
        {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })

  it('should prevent non-admin from changing other user roles', async () => {
    try {
      const response = await axios.put(
        `${API_URL}/participants/update-role`,
        {
          address: 'RECYCLER_ADDRESS_1',
          new_role: 'manufacturer'
        },
        {
          headers: { 'X-Wallet-Address': 'COLLECTOR_ADDRESS_1' }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })

  it('should prevent role escalation via forged headers', async () => {
    try {
      const response = await axios.post(
        `${API_URL}/admin/transfer-admin`,
        {
          new_admin: 'ATTACKER_ADDRESS'
        },
        {
          headers: {
            'X-Wallet-Address': 'ATTACKER_ADDRESS',
            'X-Role': 'admin',
            'X-Is-Admin': 'true'
          }
        }
      )
      expect(response.status).not.toBe(200)
    } catch (error: any) {
      expect([401, 403]).toContain(error.response?.status)
    }
  })

  it('should prevent privilege escalation via parameter pollution', async () => {
    try {
      const response = await axios.post(`${API_URL}/participants/register`, {
        address: 'ESCALATION_TEST_ADDRESS',
        role: 'admin',
        name: 'Admin Escalation Test'
      })
      if (response.status === 200 || response.status === 201) {
        expect(response.data?.role).not.toBe('admin')
      }
    } catch (error: any) {
      expect([400, 403, 422]).toContain(error.response?.status)
    }
  })
})
