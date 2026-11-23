import { ContractConfig } from '../types';
import { LogLevel } from '../lib/constants';
import { env } from './env';

interface AppConfig {
  contract: ContractConfig;
  api: {
    baseUrl: string;
    timeout: number;
  };
  features: {
    offlineMode: boolean;
    analytics: boolean;
    notifications: boolean;
  };
  logging: {
    level: LogLevel;
    enableConsole: boolean;
  };
}

function loadConfig(): AppConfig {
  // Validation and defaults are handled by the zod-validated env module.
  const contractConfig: ContractConfig = {
    contractId: env.VITE_CONTRACT_ID,
    network: env.VITE_NETWORK as ContractConfig['network'],
    rpcUrl: env.VITE_RPC_URL,
  };

  return {
    contract: contractConfig,
    api: {
      baseUrl: env.VITE_API_BASE_URL,
      timeout: env.VITE_API_TIMEOUT,
    },
    features: {
      offlineMode: env.VITE_OFFLINE_MODE,
      analytics: env.VITE_ANALYTICS,
      notifications: env.VITE_NOTIFICATIONS,
    },
    logging: {
      level: env.VITE_LOG_LEVEL,
      enableConsole: env.VITE_LOG_CONSOLE,
    },
  };
}

export const config = loadConfig();
