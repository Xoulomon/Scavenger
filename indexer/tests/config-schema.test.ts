/**
 * Typed config schema (#1786): defaults, parsing, fallbacks and startup validation.
 */

describe('indexer config schema (#1786)', () => {
  const originalEnv = process.env;

  function loadModule(env: Record<string, string>) {
    jest.resetModules();
    process.env = { ...env } as NodeJS.ProcessEnv;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../src/config') as typeof import('../src/config');
  }

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('uses documented defaults for an empty environment', () => {
    const { loadConfig } = loadModule({});
    const { value, issues } = loadConfig({});
    expect(issues).toEqual([]);
    expect(value).toEqual({
      database: {
        url: 'postgresql://localhost/scavenger',
        maxConnections: 20,
        minConnections: 2,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 5000,
        statementTimeoutMs: 30000,
      },
      stellar: { network: 'testnet', rpcUrl: 'https://soroban-testnet.stellar.org', contractId: '' },
      logging: { level: 'info', format: 'json' },
      performance: { slowQueryThreshold: 100, batchSize: 100 },
      server: { apiPort: 3001, apiHost: '0.0.0.0' },
      indexer: { startLedger: 0, pollIntervalMs: 5000 },
    });
  });

  it('reads every documented variable', () => {
    const { loadConfig } = loadModule({});
    const { value, issues } = loadConfig({
      DATABASE_URL: 'postgresql://db/x',
      DB_MAX_CONNECTIONS: '9',
      DB_MIN_CONNECTIONS: '1',
      DB_IDLE_TIMEOUT_MS: '111',
      DB_CONNECTION_TIMEOUT_MS: '222',
      DB_STATEMENT_TIMEOUT_MS: '333',
      STELLAR_NETWORK: 'mainnet',
      STELLAR_RPC_URL: 'https://rpc.example',
      CONTRACT_ID: 'C123',
      LOG_LEVEL: 'debug',
      LOG_FORMAT: 'pretty',
      SLOW_QUERY_THRESHOLD: '250',
      BATCH_SIZE: '10',
      API_PORT: '8080',
      API_HOST: '127.0.0.1',
      START_LEDGER: '99',
      POLL_INTERVAL_MS: '1000',
    });
    expect(issues).toEqual([]);
    expect(value.database).toEqual({
      url: 'postgresql://db/x',
      maxConnections: 9,
      minConnections: 1,
      idleTimeoutMs: 111,
      connectionTimeoutMs: 222,
      statementTimeoutMs: 333,
    });
    expect(value.stellar).toEqual({ network: 'mainnet', rpcUrl: 'https://rpc.example', contractId: 'C123' });
    expect(value.logging).toEqual({ level: 'debug', format: 'pretty' });
    expect(value.performance).toEqual({ slowQueryThreshold: 250, batchSize: 10 });
    expect(value.server).toEqual({ apiPort: 8080, apiHost: '127.0.0.1' });
    expect(value.indexer).toEqual({ startLedger: 99, pollIntervalMs: 1000 });
  });

  it('never produces NaN: bad or empty numeric values fall back to defaults', () => {
    const { loadConfig } = loadModule({});
    const { value, issues } = loadConfig({
      API_PORT: 'abc',
      START_LEDGER: 'x',
      POLL_INTERVAL_MS: '',
      SLOW_QUERY_THRESHOLD: 'slow',
      BATCH_SIZE: '0',
    });
    expect(value.server.apiPort).toBe(3001);
    expect(value.indexer.startLedger).toBe(0);
    expect(value.indexer.pollIntervalMs).toBe(5000);
    expect(value.performance).toEqual({ slowQueryThreshold: 100, batchSize: 100 });
    expect(issues.map((issue) => issue.variable).sort()).toEqual(
      ['API_PORT', 'BATCH_SIZE', 'SLOW_QUERY_THRESHOLD', 'START_LEDGER'],
    );
  });

  it('rejects an out-of-range port and an unknown log format', () => {
    const { loadConfig } = loadModule({});
    const { value, issues } = loadConfig({ API_PORT: '70000', LOG_FORMAT: 'xml' });
    expect(value.server.apiPort).toBe(3001);
    expect(value.logging.format).toBe('json');
    expect(issues).toHaveLength(2);
  });

  it('prefers DB_IDLE_TIMEOUT_MS over the DB_IDLE_TIMEOUT alias', () => {
    const { loadConfig } = loadModule({});
    expect(loadConfig({ DB_IDLE_TIMEOUT_MS: '1', DB_IDLE_TIMEOUT: '2' }).value.database.idleTimeoutMs).toBe(1);
    expect(loadConfig({ DB_IDLE_TIMEOUT: '2' }).value.database.idleTimeoutMs).toBe(2);
  });

  describe('validateConfig', () => {
    it('throws when CONTRACT_ID is missing', () => {
      const { validateConfig } = loadModule({ DATABASE_URL: 'postgresql://db/x' });
      expect(() => validateConfig()).toThrow('CONTRACT_ID environment variable is required');
    });

    it('throws when DATABASE_URL is missing', () => {
      const { validateConfig } = loadModule({ CONTRACT_ID: 'C123' });
      expect(() => validateConfig()).toThrow('DATABASE_URL environment variable is required');
    });

    it('passes silently with valid configuration', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { validateConfig } = loadModule({ CONTRACT_ID: 'C123', DATABASE_URL: 'postgresql://db/x' });
      expect(() => validateConfig()).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns about values that were replaced by defaults', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { validateConfig, config } = loadModule({
        CONTRACT_ID: 'C123',
        DATABASE_URL: 'postgresql://db/x',
        API_PORT: 'abc',
      });
      expect(() => validateConfig()).not.toThrow();
      expect(config.server.apiPort).toBe(3001);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('API_PORT'));
    });
  });
});
