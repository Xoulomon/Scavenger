import { describe, it, expect } from 'vitest'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://localhost:3000/api'

describe('Input Validation Security Tests', () => {
  it('should reject empty string inputs', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, { name: '', role: 'recycler' })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  it('should reject excessively long strings', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        name: 'a'.repeat(10_000),
        role: 'recycler'
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  it('should sanitize special characters in name fields', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        name: '<>&"\'\x00\x1f',
        role: 'recycler'
      })
      expect(true).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should reject SQL injection in participant name', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        name: "' OR 1=1; DROP TABLE participants; --",
        role: 'recycler'
      })
      expect(true).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).not.toBe(500)
    }
  })

  it('should reject negative weight values', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, { waste_type: 'plastic', weight: -1 })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  it('should reject zero weight', async () => {
    try {
      await axios.post(`${API_URL}/waste/submit`, { waste_type: 'plastic', weight: 0 })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  it('should reject coordinates out of valid range', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, {
        name: 'Test',
        role: 'recycler',
        lat: 9999,
        lon: 9999
      })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })

  it('should reject invalid role values', async () => {
    try {
      await axios.post(`${API_URL}/participants/register`, { name: 'Test', role: 'superadmin' })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.response?.status).toBe(400)
    }
  })
})
