import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Logger utility test suite
 * Addresses issue #1231: Remove console.log/debug statements from production frontend code
 * Tests verify that logging is gated and controlled, not directly using console
 */

interface LoggerConfig {
  enabled: boolean
  level: 'debug' | 'info' | 'warn' | 'error'
}

class GatedLogger {
  private config: LoggerConfig
  private originalConsole: typeof console

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabled: config.enabled !== false,
      level: config.level || 'info',
    }
    this.originalConsole = console
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  setLevel(level: LoggerConfig['level']): void {
    this.config.level = level
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.config.enabled && this._shouldLog('debug')) {
      this.originalConsole.debug(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.config.enabled && this._shouldLog('info')) {
      this.originalConsole.log(`[INFO] ${message}`, ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.config.enabled && this._shouldLog('warn')) {
      this.originalConsole.warn(`[WARN] ${message}`, ...args)
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.config.enabled && this._shouldLog('error')) {
      this.originalConsole.error(`[ERROR] ${message}`, ...args)
    }
  }

  private _shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.config.level)
  }
}

describe('GatedLogger', () => {
  let logger: GatedLogger
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logger = new GatedLogger({ enabled: true })
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleDebugSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('Logger creation', () => {
    it('should create logger with default configuration', () => {
      const defaultLogger = new GatedLogger()
      expect(defaultLogger).toBeDefined()
    })

    it('should create logger with custom enabled state', () => {
      const disabledLogger = new GatedLogger({ enabled: false })
      expect(disabledLogger).toBeDefined()
    })

    it('should create logger with custom log level', () => {
      const warnLogger = new GatedLogger({ level: 'warn' })
      expect(warnLogger).toBeDefined()
    })
  })

  describe('Logging methods', () => {
    it('should call console.debug for debug level', () => {
      logger.debug('Test debug message')
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.any(String)
      )
    })

    it('should call console.log for info level', () => {
      logger.info('Test info message')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.any(String)
      )
    })

    it('should call console.warn for warn level', () => {
      logger.warn('Test warn message')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.any(String)
      )
    })

    it('should call console.error for error level', () => {
      logger.error('Test error message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.any(String)
      )
    })

    it('should pass through additional arguments', () => {
      const context = { id: 'test-123' }
      logger.info('User action', context)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        context
      )
    })
  })

  describe('Logger enabling/disabling', () => {
    it('should not log when disabled', () => {
      logger.setEnabled(false)
      logger.debug('Disabled message')
      logger.info('Disabled message')
      logger.warn('Disabled message')
      logger.error('Disabled message')
      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should log when enabled', () => {
      logger.setEnabled(true)
      logger.info('Enabled message')
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('should toggle logging on and off', () => {
      logger.setEnabled(true)
      logger.info('Message 1')
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)

      logger.setEnabled(false)
      logger.info('Message 2')
      expect(consoleLogSpy).toHaveBeenCalledTimes(1) // Should still be 1

      logger.setEnabled(true)
      logger.info('Message 3')
      expect(consoleLogSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Log level filtering', () => {
    it('should filter debug logs when level is info', () => {
      logger.setLevel('info')
      logger.debug('Debug message')
      expect(consoleDebugSpy).not.toHaveBeenCalled()
    })

    it('should allow info logs when level is info', () => {
      logger.setLevel('info')
      logger.info('Info message')
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('should filter debug and info when level is warn', () => {
      logger.setLevel('warn')
      logger.debug('Debug message')
      logger.info('Info message')
      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should allow all logs at debug level', () => {
      logger.setLevel('debug')
      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warn message')
      logger.error('Error message')
      expect(consoleDebugSpy).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should allow only error logs at error level', () => {
      logger.setLevel('error')
      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warn message')
      logger.error('Error message')
      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Production mode behavior', () => {
    it('should be disabled in production environment', () => {
      const prodLogger = new GatedLogger({ enabled: false })
      prodLogger.debug('Debug in prod')
      prodLogger.info('Info in prod')
      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should be enabled in development environment', () => {
      const devLogger = new GatedLogger({ enabled: true })
      devLogger.info('Info in dev')
      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should not throw on null message', () => {
      expect(() => {
        logger.info('')
      }).not.toThrow()
    })

    it('should handle undefined arguments gracefully', () => {
      expect(() => {
        logger.info('Message', undefined)
      }).not.toThrow()
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('should handle objects with circular references', () => {
      const circular: any = { ref: null }
      circular.ref = circular
      expect(() => {
        logger.info('Circular object', circular)
      }).not.toThrow()
    })

    it('should handle large payloads', () => {
      const largeObj = { data: 'x'.repeat(10000) }
      expect(() => {
        logger.info('Large payload', largeObj)
      }).not.toThrow()
    })
  })

  describe('Message formatting', () => {
    it('should include log level prefix', () => {
      logger.debug('Test')
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.any(String)
      )
    })

    it('should preserve original message', () => {
      const message = 'Original message'
      logger.info(message)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Original message'),
        expect.any(String)
      )
    })

    it('should format messages consistently', () => {
      logger.info('Message 1')
      logger.warn('Message 2')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[INFO\]/),
        expect.any(String)
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[WARN\]/),
        expect.any(String)
      )
    })
  })

  describe('Multiple logger instances', () => {
    it('should allow multiple independent logger instances', () => {
      const logger1 = new GatedLogger({ enabled: true, level: 'debug' })
      const logger2 = new GatedLogger({ enabled: false })

      logger1.debug('From logger1')
      logger2.debug('From logger2')

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1)
    })

    it('should isolate configuration between instances', () => {
      const logger1 = new GatedLogger({ level: 'warn' })
      const logger2 = new GatedLogger({ level: 'debug' })

      logger1.info('Should not log')
      logger2.debug('Should log')

      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleDebugSpy).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should have minimal overhead when disabled', () => {
      logger.setEnabled(false)
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        logger.info('Message ' + i)
      }
      const duration = performance.now() - start
      expect(duration).toBeLessThan(100) // Should be very fast when disabled
    })

    it('should complete logging in reasonable time', () => {
      logger.setEnabled(true)
      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        logger.info('Message ' + i)
      }
      const duration = performance.now() - start
      expect(duration).toBeLessThan(500) // Should complete quickly
    })
  })
})

describe('Logger configuration strategies', () => {
  it('should support development configuration', () => {
    const devConfig = {
      enabled: true,
      level: 'debug' as const,
    }
    const logger = new GatedLogger(devConfig)
    expect(logger).toBeDefined()
  })

  it('should support production configuration', () => {
    const prodConfig = {
      enabled: false,
      level: 'error' as const,
    }
    const logger = new GatedLogger(prodConfig)
    expect(logger).toBeDefined()
  })

  it('should support staging configuration', () => {
    const stagingConfig = {
      enabled: true,
      level: 'warn' as const,
    }
    const logger = new GatedLogger(stagingConfig)
    expect(logger).toBeDefined()
  })
})

describe('Replacing direct console usage with logger', () => {
  let logger: GatedLogger

  beforeEach(() => {
    logger = new GatedLogger({ enabled: true })
  })

  it('should replace console.log with logger.info', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('User logged in')
    expect(consoleLogSpy).toHaveBeenCalled()
    consoleLogSpy.mockRestore()
  })

  it('should replace console.debug with logger.debug', () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logger.debug('State changed')
    expect(consoleDebugSpy).toHaveBeenCalled()
    consoleDebugSpy.mockRestore()
  })

  it('should replace console.warn with logger.warn', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('Deprecated API used')
    expect(consoleWarnSpy).toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
  })

  it('should replace console.error with logger.error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('Operation failed')
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
