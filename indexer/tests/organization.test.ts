import { describe, it, expect } from 'vitest'
import { config, validateConfig } from '../src/config'
import { WASTE_TYPES, PARTICIPANT_ROLES, QUERY_LIMITS } from '../src/constants'

describe('Code Organization', () => {
  describe('Configuration', () => {
    it('should load configuration from environment', () => {
      expect(config.database.url).toBeDefined()
      expect(config.stellar.network).toBeDefined()
      expect(config.logging.level).toBeDefined()
    })

    it('should have valid default values', () => {
      expect(config.database.maxConnections).toBeGreaterThan(0)
      expect(config.performance.slowQueryThreshold).toBeGreaterThan(0)
    })
  })

  describe('Constants', () => {
    it('should define waste types', () => {
      expect(WASTE_TYPES).toContain('Paper')
      expect(WASTE_TYPES).toContain('Plastic')
      expect(WASTE_TYPES.length).toBeGreaterThan(0)
    })

    it('should define participant roles', () => {
      expect(PARTICIPANT_ROLES).toContain('Recycler')
      expect(PARTICIPANT_ROLES).toContain('Collector')
      expect(PARTICIPANT_ROLES).toContain('Manufacturer')
    })

    it('should define query limits', () => {
      expect(QUERY_LIMITS.DEFAULT).toBeLessThanOrEqual(QUERY_LIMITS.MAX)
      expect(QUERY_LIMITS.MIN).toBeGreaterThan(0)
    })
  })
})
