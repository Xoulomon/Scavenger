import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Broken Authentication', () => {
  describe('Missing Authentication', () => {
    it('should reject requests to protected endpoints without credentials', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: 100,
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject admin operations without authentication', async () => {
      try {
        await axios.post(`${API_URL}/admin/pause`);
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject participant deregistration without authentication', async () => {
      try {
        await axios.post(`${API_URL}/participants/deregister`, {
          address: 'some-address',
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });
  });

  describe('Invalid Tokens', () => {
    it('should reject malformed JWT tokens', async () => {
      try {
        await axios.get(`${API_URL}/participants`, {
          headers: { 'Authorization': 'Bearer not.a.valid.jwt' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject tokens with invalid signature', async () => {
      try {
        const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIGNATURE';
        await axios.get(`${API_URL}/participants`, {
          headers: { 'Authorization': `Bearer ${fakeToken}` },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject empty bearer tokens', async () => {
      try {
        await axios.get(`${API_URL}/participants`, {
          headers: { 'Authorization': 'Bearer ' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject non-bearer authentication schemes', async () => {
      try {
        await axios.get(`${API_URL}/participants`, {
          headers: { 'Authorization': 'Basic dXNlcjpwYXNz' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 401, 403]).toContain(error.response?.status);
      }
    });
  });

  describe('Expired Tokens', () => {
    it('should reject tokens with past expiry', async () => {
      try {
        const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.expired';
        await axios.get(`${API_URL}/participants`, {
          headers: { 'Authorization': `Bearer ${expiredToken}` },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });
  });

  describe('Wallet-Based Authentication Bypass', () => {
    it('should reject empty wallet address header', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: 100,
        }, {
          headers: { 'X-Wallet-Address': '' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject forged wallet address header', async () => {
      try {
        const res = await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: 100,
          submitter: 'DIFFERENT_WALLET',
        }, {
          headers: { 'X-Wallet-Address': 'FORGED_WALLET_ADDRESS' },
        });
        if (res.status === 200) {
          expect(res.data.submitter).not.toBe('DIFFERENT_WALLET');
        }
      } catch (error: any) {
        expect([400, 401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject spoofed X-Role headers', async () => {
      try {
        await axios.post(`${API_URL}/admin/pause`, {}, {
          headers: {
            'X-Wallet-Address': 'RECYCLER_ADDRESS_1',
            'X-Role': 'admin',
          },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });

    it('should reject spoofed X-Is-Admin headers', async () => {
      try {
        await axios.post(`${API_URL}/admin/pause`, {}, {
          headers: {
            'X-Wallet-Address': 'RECYCLER_ADDRESS_1',
            'X-Is-Admin': 'true',
          },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });
  });

  describe('Session Security', () => {
    it('should not expose session tokens in response headers', async () => {
      const res = await axios.get(`${API_URL}/health`);
      const headers = res.headers;
      expect(headers['x-session-token']).toBeUndefined();
      expect(headers['set-cookie']).toBeUndefined();
    });

    it('should include security headers on responses', async () => {
      const res = await axios.get(`${API_URL}/health`);
      expect(res.headers['x-content-type-options']).toBeDefined();
    });
  });
});
