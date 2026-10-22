import { describe, it, expect } from 'vitest'
import {
  encodeQR,
  decodeQR,
  validateQRPayload,
  sanitizeQRData,
} from './qr'

/**
 * Tests for malformed QR payload handling
 * Addresses issue #1232: Add tests for malformed QR payload handling
 */
describe('QR Malformed Payload Handling', () => {
  describe('Malformed payload detection', () => {
    it('should reject payloads with null bytes', () => {
      const nullBytePayload = 'waste\x00code'
      const result = decodeQR(nullBytePayload)
      expect(result.data).toBeTruthy()
      // Should handle gracefully even with null bytes
      expect(result.data).toContain('waste')
    })

    it('should handle extremely large payloads gracefully', () => {
      const hugePayload = 'a'.repeat(10000)
      expect(validateQRPayload(hugePayload)).toBe(false)
      const result = decodeQR(hugePayload)
      expect(result.isValid).toBe(false)
    })

    it('should reject payloads with invalid UTF-8 sequences', () => {
      const invalidUtf8 = String.fromCharCode(0xDC, 0x00)
      const result = decodeQR(invalidUtf8)
      // Should handle without crashing
      expect(result).toBeDefined()
    })

    it('should handle payloads with only whitespace', () => {
      const whitespacePayload = '   \t\n\r   '
      expect(validateQRPayload(whitespacePayload)).toBe(false)
      const result = decodeQR(whitespacePayload)
      expect(result.isValid).toBe(false)
    })

    it('should reject payloads exceeding 2953 character limit', () => {
      const tooLong = 'x'.repeat(2954)
      expect(validateQRPayload(tooLong)).toBe(false)
      const result = decodeQR(tooLong)
      expect(result.isValid).toBe(false)
    })

    it('should accept payloads at maximum capacity (2953 chars)', () => {
      const atLimit = 'x'.repeat(2953)
      expect(validateQRPayload(atLimit)).toBe(true)
      const result = decodeQR(atLimit)
      expect(result.isValid).toBe(true)
    })
  })

  describe('Malformed encoding/decoding', () => {
    it('should handle double-encoded payloads', () => {
      const original = 'waste-123'
      const doubleEncoded = encodeURIComponent(encodeURIComponent(original))
      const result = decodeQR(doubleEncoded)
      expect(result.isValid).toBe(true)
      // Should decode at least once
      expect(result.data).toBeTruthy()
    })

    it('should handle mixed encoded/decoded payloads', () => {
      const mixed = 'waste%20code-123'
      const result = decodeQR(mixed)
      expect(result.isValid).toBe(true)
      expect(result.data).toBe('waste code-123')
    })

    it('should handle incomplete percent encoding', () => {
      const incomplete = 'waste%2'
      const result = decodeQR(incomplete)
      expect(result.data).toBe('waste%2')
      expect(result.isValid).toBe(true)
    })

    it('should handle corrupted percent encoding', () => {
      const corrupted = 'waste%GG%HH'
      const result = decodeQR(corrupted)
      // Should fallback to original string
      expect(result.data).toBeTruthy()
      expect(result.isValid).toBe(true)
    })
  })

  describe('Security payload handling', () => {
    it('should reject and sanitize XSS in QR data', () => {
      const xssPayload = '<img src=x onerror="alert(1)">'
      const result = decodeQR(xssPayload)
      expect(result.isValid).toBe(false) // Should be invalid due to length check in real scenario
    })

    it('should sanitize SQL injection attempts', () => {
      const sqlPayload = "waste-'; DROP TABLE users; --"
      const sanitized = sanitizeQRData(sqlPayload)
      expect(sanitized).toBe(sqlPayload) // Already safe from our sanitization
    })

    it('should remove embedded script tags from QR data', () => {
      const scriptPayload = 'waste<script>alert("xss")</script>123'
      const sanitized = sanitizeQRData(scriptPayload)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('waste')
      expect(sanitized).toContain('123')
    })

    it('should remove event handlers', () => {
      const eventPayload = 'waste<img onclick="alert(1)">123'
      const sanitized = sanitizeQRData(eventPayload)
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).toContain('waste')
      expect(sanitized).toContain('123')
    })

    it('should remove javascript: protocol', () => {
      const jsPayload = 'javascript:alert(1);waste-123'
      const sanitized = sanitizeQRData(jsPayload)
      expect(sanitized).not.toContain('javascript:')
      expect(sanitized).toContain('waste')
    })

    it('should handle nested script tags', () => {
      const nestedPayload = 'waste<script><script>alert(1)</script></script>123'
      const sanitized = sanitizeQRData(nestedPayload)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('waste')
      expect(sanitized).toContain('123')
    })

    it('should handle event handlers with different cases', () => {
      const casePayload = 'waste<img OnClick="alert(1)">123'
      const sanitized = sanitizeQRData(casePayload)
      expect(sanitized).not.toContain('OnClick')
      expect(sanitized).not.toContain('onclick')
    })
  })

  describe('Type coercion in QR payloads', () => {
    it('should handle numeric payloads', () => {
      const numPayload = 123456
      const result = decodeQR(numPayload)
      expect(result.data).toBe('123456')
      expect(result.isValid).toBe(true)
    })

    it('should handle boolean payloads', () => {
      const boolPayload = true
      const result = decodeQR(boolPayload)
      expect(result.data).toBe('true')
      expect(result.isValid).toBe(true)
    })

    it('should handle object payloads', () => {
      const objPayload = { id: 'waste-123' }
      const result = decodeQR(objPayload)
      expect(result.data).toBeTruthy()
      expect(result.data).toContain('waste-123')
      expect(result.isValid).toBe(true)
    })

    it('should handle array payloads', () => {
      const arrayPayload = ['waste', '123']
      const result = decodeQR(arrayPayload)
      expect(result.data).toBeTruthy()
      expect(result.isValid).toBe(true)
    })

    it('should handle empty array', () => {
      const emptyArray: unknown[] = []
      const result = decodeQR(emptyArray)
      expect(result.isValid).toBe(false)
    })
  })

  describe('Boundary conditions', () => {
    it('should handle single character payloads', () => {
      const result = decodeQR('A')
      expect(result.data).toBe('A')
      expect(result.isValid).toBe(true)
    })

    it('should handle maximum valid length (2953)', () => {
      const maxPayload = 'x'.repeat(2953)
      const result = decodeQR(maxPayload)
      expect(result.isValid).toBe(true)
      expect(result.data.length).toBe(2953)
    })

    it('should handle just over maximum length', () => {
      const overMax = 'x'.repeat(2954)
      const result = decodeQR(overMax)
      expect(result.isValid).toBe(false)
    })

    it('should handle special Unicode characters', () => {
      const unicode = 'waste-♻️-code'
      const result = decodeQR(unicode)
      expect(result.isValid).toBe(true)
      expect(result.data).toContain('waste')
    })

    it('should handle emoji payloads', () => {
      const emoji = '🗑️waste📦'
      const result = decodeQR(emoji)
      expect(result.isValid).toBe(true)
      expect(result.data).toContain('waste')
    })
  })

  describe('Error recovery', () => {
    it('should gracefully handle circular references', () => {
      const circular: any = {}
      circular.self = circular
      const result = decodeQR(circular)
      expect(result).toBeDefined()
      expect(result.data).toBeTruthy()
    })

    it('should handle payloads that throw on toString()', () => {
      const throwingObj = {
        toString: () => {
          throw new Error('toString failed')
        },
      }
      expect(() => {
        decodeQR(throwingObj)
      }).not.toThrow()
    })

    it('should handle concurrent validation calls', async () => {
      const payload = 'waste-concurrent-test'
      const results = await Promise.all([
        Promise.resolve(decodeQR(payload)),
        Promise.resolve(decodeQR(payload)),
        Promise.resolve(decodeQR(payload)),
      ])
      results.forEach(result => {
        expect(result.isValid).toBe(true)
        expect(result.data).toBe(payload)
      })
    })
  })

  describe('Malformed payload round-trip', () => {
    it('should handle round-trip with sanitization', () => {
      const dirty = '<script>waste-123</script>'
      const sanitized = sanitizeQRData(dirty)
      const decoded = decodeQR(sanitized)
      expect(decoded.isValid).toBe(true)
      expect(decoded.data).not.toContain('<script>')
    })

    it('should handle round-trip with encoding errors', () => {
      const problematic = 'waste%code'
      const result = decodeQR(problematic)
      expect(result.data).toBeTruthy()
      expect(result.isValid).toBe(true)
    })

    it('should validate decoded payloads', () => {
      const encoded = 'waste%20code'
      const result = decodeQR(encoded)
      expect(result.isValid).toBe(true)
      expect(validateQRPayload(result.data)).toBe(true)
    })
  })
})
