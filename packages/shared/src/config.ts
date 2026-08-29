export interface AppConfig {
  contract: {
    contractId: string;
    network: 'TESTNET' | 'MAINNET' | 'FUTURENET' | 'STANDALONE';
    rpcUrl: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
  };
}

export function validateContractConfig(config: AppConfig['contract']): void {
  if (!config.contractId) throw new Error('CONTRACT_ID environment variable is required');
  if (!config.network) throw new Error('NETWORK environment variable is required');
  if (!config.rpcUrl) throw new Error('RPC_URL environment variable is required');
}

export function loadConfig(): AppConfig {
  const contractConfig: AppConfig['contract'] = {
    contractId: import.meta.env.VITE_CONTRACT_ID || '',
    network: (import.meta.env.VITE_NETWORK || 'TESTNET') as AppConfig['contract']['network'],
    rpcUrl: import.meta.env.VITE_RPC_URL || '',
  };

  validateContractConfig(contractConfig);

  return {
    contract: contractConfig,
    api: {
      baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
    },
    logging: {
      level: (import.meta.env.VITE_LOG_LEVEL || 'info') as AppConfig['logging']['level'],
      enableConsole: import.meta.env.VITE_LOG_CONSOLE !== 'false',
    },
  };
}