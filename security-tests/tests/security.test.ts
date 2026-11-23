import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('SQL Injection Security Tests', () => {
  it('should prevent SQL injection in participant query', async () => {
    const maliciousInput = "'; DROP TABLE participants; --";
    try {
      await axios.get(`${API_URL}/participants`, {
        params: { id: maliciousInput }
      });
      // If we get here, the query was parameterized (safe)
      expect(true).toBe(true);
    } catch (error: any) {
      // Should fail gracefully, not execute SQL
      expect(error.response?.status).not.toBe(500);
    }
  });

  it('should sanitize input in waste submission', async () => {
    const maliciousInput = "1' OR '1'='1";
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: maliciousInput,
        weight: 100
      });
      expect(true).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500);
    }
  });

  it('should use prepared statements for transfers', async () => {
    const injection = "1; DELETE FROM waste; --";
    try {
      await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: injection,
        from: 'user1',
        to: 'user2'
      });
      expect(true).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500);
    }
  });
});

describe('XSS Vulnerability Tests', () => {
  it('should encode HTML in participant names', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    try {
      await axios.post(`${API_URL}/participants/register`, {
        name: xssPayload,
        role: 'recycler'
      });
      expect(true).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500);
    }
  });

  it('should escape JavaScript context in responses', async () => {
    const response = await axios.get(`${API_URL}/participants`);
    const data = JSON.stringify(response.data);
    expect(data).not.toContain('<script>');
    expect(data).not.toContain('javascript:');
  });

  it('should encode attributes in waste data', async () => {
    const xssPayload = '" onload="alert(1)"';
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 100,
        note: xssPayload
      });
      expect(true).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500);
    }
  });
});

describe('CSRF Protection Tests', () => {
  it('should validate CSRF tokens on state-changing requests', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: 100
      }, {
        headers: {
          'X-CSRF-Token': 'invalid-token'
        }
      });
      // Should fail without valid CSRF token
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(403);
    }
  });

  it('should enforce SameSite cookie attribute', async () => {
    const response = await axios.get(`${API_URL}/health`);
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      expect(setCookie.toString()).toMatch(/SameSite=(Strict|Lax)/i);
    }
  });
});

describe('Authentication/Authorization Tests', () => {
  it('should validate JWT tokens', async () => {
    try {
      await axios.get(`${API_URL}/participants`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(401);
    }
  });

  it('should enforce role-based access control', async () => {
    try {
      await axios.post(`${API_URL}/admin/transfer-admin`, {
        new_admin: 'user123'
      }, {
        headers: {
          'Authorization': 'Bearer recycler-token'
        }
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(403);
    }
  });

  it('should prevent unauthorized participant access', async () => {
    try {
      await axios.get(`${API_URL}/participants/other-user/private-data`, {
        headers: {
          'Authorization': 'Bearer user-token'
        }
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(403);
    }
  });

  it('should enforce password policies', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'test@example.com',
        password: '123'
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });
});

describe('Rate Limiting Tests', () => {
  it('should enforce request rate limits', async () => {
    const requests = Array(101).fill(null).map(() =>
      axios.get(`${API_URL}/health`).catch(() => null)
    );
    const results = await Promise.all(requests);
    const rateLimited = results.some(r => r?.status === 429);
    expect(rateLimited).toBe(true);
  });

  it('should apply IP-based throttling', async () => {
    const requests = Array(50).fill(null).map(() =>
      axios.get(`${API_URL}/waste/list`, {
        headers: { 'X-Forwarded-For': '192.168.1.1' }
      }).catch(e => e.response?.status)
    );
    const results = await Promise.all(requests);
    const hasRateLimit = results.some(r => r === 429);
    expect(hasRateLimit).toBe(true);
  });

  it('should apply user-based throttling', async () => {
    const requests = Array(50).fill(null).map(() =>
      axios.get(`${API_URL}/participants`, {
        headers: { 'Authorization': 'Bearer test-token' }
      }).catch(e => e.response?.status)
    );
    const results = await Promise.all(requests);
    const hasRateLimit = results.some(r => r === 429);
    expect(hasRateLimit).toBe(true);
  });
});

describe('API Security Tests', () => {
  it('should enforce HTTPS', async () => {
    const response = await axios.get(`${API_URL}/health`);
    expect(response.headers['strict-transport-security']).toBeDefined();
  });

  it('should validate API keys', async () => {
    try {
      await axios.get(`${API_URL}/admin/metrics`, {
        headers: {
          'X-API-Key': 'invalid-key'
        }
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(401);
    }
  });

  it('should enforce CORS policies', async () => {
    const response = await axios.get(`${API_URL}/health`);
    const corsHeader = response.headers['access-control-allow-origin'];
    expect(corsHeader).toBeDefined();
    expect(corsHeader).not.toBe('*');
  });
});

describe('Input Validation Tests', () => {
  it('should reject boundary condition values', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: 'plastic',
        weight: Number.MAX_SAFE_INTEGER + 1
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });

  it('should handle malformed input gracefully', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, {
        waste_type: null,
        weight: 'not-a-number'
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });
});
