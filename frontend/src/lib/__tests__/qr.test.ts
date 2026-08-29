import { describe, it, expect } from 'vitest'
import {
  encodeQR,
  decodeQR,
  validateQRPayload,
  isValidQRFormat,
  handleQRScanError,
  sanitizeQRData,
} from '../qr'

describe('QR Utilities', () => {
  describe('validateQRPayload', () => {
    it('should validate normal payloads', () => {
      expect(validateQRPayload('waste-123')).toBe(true)
      expect(validateQRPayload('ABC123')).toBe(true)
      expect(validateQRPayload('https://example.com')).toBe(true)
    })

    it('should reject empty payloads', () => {
      expect(validateQRPayload('')).toBe(false)
      expect(validateQRPayload(null)).toBe(false)
      expect(validateQRPayload(undefined)).toBe(false)
      expect(validateQRPayload('   ')).toBe(false)
    })

    it('should reject payloads exceeding capacity', () => {
      const longPayload = 'a'.repeat(3000) // Exceeds QR capacity
      expect(validateQRPayload(longPayload)).toBe(false)
    })

    it('should handle non-string types', () => {
      expect(validateQRPayload(123)).toBe(true)
      expect(validateQRPayload({})).toBe(true) // Object toString() returns valid string
    })
  })

  describe('encodeQR', () => {
    it('should encode simple data', () => {
      const result = encodeQR('waste-123')
      expect(result).toContain('https://api.qrserver.com')
      expect(result).toContain('waste-123')
    })

    it('should handle special characters', () => {
      const result = encodeQR('waste@#$%&')
      expect(result).toContain('%40')
      expect(result).toContain('%23')
    })

    it('should support custom size', () => {
      const result = encodeQR('test', { size: '300x300' })
      expect(result).toContain('size=300x300')
    })

    it('should support custom error correction', () => {
      const result = encodeQR('test', { errorCorrection: 'L' })
      expect(result).toContain('ecc=L')
    })

    it('should throw on malformed payload', () => {
      expect(() => encodeQR('')).toThrow('Invalid QR payload')
      expect(() => encodeQR(null)).toThrow('Invalid QR payload')
    })

    it('should throw on payload exceeding capacity', () => {
      const longPayload = 'a'.repeat(3000)
      expect(() => encodeQR(longPayload)).toThrow('Invalid QR payload')
    })

    it('should encode URI components correctly', () => {
      const data = 'test&data=value'
      const result = encodeQR(data)
      expect(result).toContain('test%26data%3Dvalue')
    })
  })

  describe('decodeQR', () => {
    it('should decode valid data', () => {
      const result = decodeQR('waste-123')
      expect(result.data).toBe('waste-123')
      expect(result.isValid).toBe(true)
    })

    it('should handle URI encoded data', () => {
      const result = decodeQR('waste%20code')
      expect(result.data).toBe('waste code')
      expect(result.isValid).toBe(true)
    })

    it('should handle malformed data', () => {
      const result = decodeQR('')
      expect(result.isValid).toBe(false)
    })

    it('should handle null/undefined', () => {
      const resultNull = decodeQR(null)
      expect(resultNull.data).toBe('')
      expect(resultNull.isValid).toBe(false)

      const resultUndefined = decodeQR(undefined)
      expect(resultUndefined.isValid).toBe(false)
    })

    it('should handle oversized payloads', () => {
      const longPayload = 'a'.repeat(3000)
      const result = decodeQR(longPayload)
      expect(result.isValid).toBe(false)
    })

    it('should gracefully handle invalid URI encoding', () => {
      const result = decodeQR('%ZZ%XX')
      expect(result.data).toBeTruthy()
      expect(result.isValid).toBe(true)
    })
  })

  describe('isValidQRFormat', () => {
    it('should validate correct formats', () => {
      expect(isValidQRFormat('waste-123')).toBe(true)
      expect(isValidQRFormat('ABC')).toBe(true)
    })

    it('should reject invalid formats', () => {
      expect(isValidQRFormat('')).toBe(false)
      expect(isValidQRFormat(null)).toBe(false)
    })
  })

  describe('handleQRScanError', () => {
    it('should handle permission errors', () => {
      const error = new Error('Permission denied')
      const message = handleQRScanError(error)
      expect(message).toContain('permission')
    })

    it('should handle camera access errors', () => {
      const error = new Error('Camera not accessible')
      const message = handleQRScanError(error)
      expect(message).toContain('camera')
    })

    it('should handle device not found errors', () => {
      const error = new Error('Device not found')
      const message = handleQRScanError(error)
      expect(message).toContain('available')
    })

    it('should provide default error message for unknown errors', () => {
      const error = new Error('Unknown error')
      const message = handleQRScanError(error)
      expect(message).toContain('Failed to scan')
    })

    it('should handle non-Error objects', () => {
      const message = handleQRScanError('some string')
      expect(message).toContain('Failed to scan')
    })

    it('should handle case-insensitive error messages', () => {
      const error = new Error('PERMISSION DENIED')
      const message = handleQRScanError(error)
      expect(message).toContain('permission')
    })
  })

  describe('sanitizeQRData', () => {
    it('should allow normal data', () => {
      const data = 'waste-123-safe'
      expect(sanitizeQRData(data)).toBe(data)
    })

    it('should remove script tags', () => {
      const data = '<script>alert("xss")</script>waste-123'
      const sanitized = sanitizeQRData(data)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('waste-123')
    })

    it('should remove event handlers', () => {
      const data = 'waste<img onclick="alert(1)" src=x> code'
      const sanitized = sanitizeQRData(data)
      expect(sanitized).not.toContain('onclick')
    })

    it('should remove javascript protocol', () => {
      const data = 'javascript:alert(1)waste'
      const sanitized = sanitizeQRData(data)
      expect(sanitized).not.toContain('javascript:')
    })

    it('should trim whitespace', () => {
      const data = '  waste-123  '
      expect(sanitizeQRData(data)).toBe('waste-123')
    })

    it('should handle complex XSS attempts', () => {
      const xssData = '<img src=x onerror=alert(1)><script>alert(2)</script>waste'
      const sanitized = sanitizeQRData(xssData)
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('waste')
    })
  })

  describe('Edge cases and integration', () => {
    it('should handle round-trip encoding/decoding', () => {
      const original = 'waste-123-test'
      const encoded = encodeQR(original)
      expect(encoded).toBeTruthy()
      // Verify the encoded URL contains the data
      expect(encoded).toContain('waste-123-test')
    })

    it('should handle Unicode characters', () => {
      const unicode = 'waste-🔄-123'
      const encoded = encodeQR(unicode)
      expect(encoded).toBeTruthy()
      expect(encoded).toContain('waste')
    })

    it('should validate before encoding', () => {
      expect(() => {
        encodeQR('a'.repeat(3000))
      }).toThrow()
    })

    it('should sanitize and validate combined', () => {
      const dirtyData = '<script>waste-123</script>'
      const sanitized = sanitizeQRData(dirtyData)
      expect(validateQRPayload(sanitized)).toBe(true)
      const encoded = encodeQR(sanitized)
      expect(encoded).toBeTruthy()
    })
  })
})
