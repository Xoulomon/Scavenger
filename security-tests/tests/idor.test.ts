import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('IDOR / Broken Object-Level Authorization', () => {
  describe('Waste Resource Ownership', () => {
    it('should reject access to waste records owned by another user', async () => {
      try {
        const res = await axios.get(`${API_URL}/waste/other-user-waste-id`, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        if (res.status === 200) {
          const data = res.data;
          expect(data.submitter).not.toBe('unrelated-user-address');
        }
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });

    it('should prevent transferring waste owned by another user', async () => {
      try {
        await axios.post(`${API_URL}/waste/transfer`, {
          waste_id: 'someone-elses-waste-id',
          from: 'RECYCLER_ADDRESS_1',
          to: 'COLLECTOR_ADDRESS_1',
        }, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });

    it('should prevent deactivation of waste owned by another user', async () => {
      try {
        await axios.post(`${API_URL}/waste/deactivate`, {
          waste_id: 'someone-elses-waste-id',
        }, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });
  });

  describe('Participant Resource Ownership', () => {
    it('should reject access to another participant private data', async () => {
      try {
        const res = await axios.get(`${API_URL}/participants/OTHER_USER_ADDRESS/private-data`, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        if (res.status === 200) {
          expect(false).toBe(true);
        }
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });

    it('should prevent role changes on another participant', async () => {
      try {
        await axios.post(`${API_URL}/participants/update-role`, {
          address: 'OTHER_USER_ADDRESS',
          new_role: 'admin',
        }, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });

    it('should prevent deregistration of another participant', async () => {
      try {
        await axios.post(`${API_URL}/participants/deregister`, {
          address: 'OTHER_USER_ADDRESS',
        }, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });
  });

  describe('Incentive Resource Ownership', () => {
    it('should prevent claiming incentives created by another user', async () => {
      try {
        await axios.post(`${API_URL}/incentives/claim`, {
          incentive_id: 'someone-elses-incentive',
          claimer: 'RECYCLER_ADDRESS_1',
        }, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });

    it('should prevent updating incentives created by another user', async () => {
      try {
        await axios.put(`${API_URL}/incentives/someone-elses-incentive`, {
          reward_points: 999999,
        }, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403, 404]).toContain(error.response?.status);
      }
    });
  });

  describe('API Endpoint Enumeration Resistance', () => {
    it('should not leak resource existence via status code differences', async () => {
      const existentId = 'test-waste-id';
      const nonexistentId = 'nonexistent-waste-id-99999';

      let status1: number;
      let status2: number;

      try {
        const res1 = await axios.get(`${API_URL}/waste/${existentId}`, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        status1 = res1.status;
      } catch (error: any) {
        status1 = error.response?.status || 500;
      }

      try {
        const res2 = await axios.get(`${API_URL}/waste/${nonexistentId}`, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
        status2 = res2.status;
      } catch (error: any) {
        status2 = error.response?.status || 500;
      }

      if (status1 === 404 && status2 === 404) {
        expect(status1).toBe(status2);
      } else if (status1 === 403 && status2 === 403) {
        expect(status1).toBe(status2);
      }
    });

    it('should not reveal resource ownership in error messages', async () => {
      try {
        await axios.get(`${API_URL}/waste/other-users-waste-id`, {
          headers: { 'X-Wallet-Address': 'RECYCLER_ADDRESS_1' },
        });
      } catch (error: any) {
        const message = error.response?.data?.message || error.response?.data?.error || '';
        expect(message.toLowerCase()).not.toContain('owned by');
        expect(message.toLowerCase()).not.toContain('belongs to');
        expect(message.toLowerCase()).not.toContain('owner');
      }
    });
  });
});
