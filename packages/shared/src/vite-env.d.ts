/// Ambient type declarations for Vite's import.meta.env.
/// This covers the env vars used in config.ts without requiring vite as a
/// package dependency. In a Vite project the vite/client types take
/// precedence; here they are only needed for standalone tsc type-checking.

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ID: string;
  readonly VITE_NETWORK: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_LOG_LEVEL: string;
  readonly VITE_LOG_CONSOLE: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
