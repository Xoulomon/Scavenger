/**
 * Non-numeric integer env values fall back to defaults instead of NaN (#1705).
 */

describe('database integer env parsing (#1705)', () => {
  const originalEnv = { ...process.env }

  function loadConfig() {
    jest.resetModules()
    return require('../src/config').config
  }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses the default when DB_MAX_CONNECTIONS is not a number', () => {
    process.env.DB_MAX_CONNECTIONS = 'abc'

    expect(loadConfig().database.maxConnections).toBe(20)
  })

  it('reads a numeric DB_MAX_CONNECTIONS', () => {
    process.env.DB_MAX_CONNECTIONS = '7'

    expect(loadConfig().database.maxConnections).toBe(7)
  })

  it('falls back to the default idle timeout for a non-numeric value', () => {
    process.env.DB_IDLE_TIMEOUT_MS = 'soon'
    delete process.env.DB_IDLE_TIMEOUT

    expect(loadConfig().database.idleTimeoutMs).toBe(30000)
  })
})
