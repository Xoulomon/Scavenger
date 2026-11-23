import { z } from 'zod'

/**
 * Shared environment/config schema and types.
 *
 * This module is the single source of truth for application configuration
 * validation. The frontend env module (`frontend/src/config`) re-exports these
 * types/schema and delegates validation here to avoid duplicate validation logic.
 *
 * Backwards-compatibility impact:
 * - `AppConfig` shape is preserved (contract/api/logging) so existing callers
 *   continue to work.
 * - `loadConfig()` and `validateContractConfig()` remain exported with the same
 *   signatures.
 * - Validation is now performed via zod; error messages are preserved for the
 *   required contract fields to keep existing tests/consumers stable.
 */

export const NETWORKS = ['TESTNET', 'MAINNET', 'FUTURENET', 'STANDALONE'] as const
export type Network = (typeof NETWORKS)[number]

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export const contractConfigSchema = z.object({
  contractId: z.string().min(1, 'CONTRACT_ID environment variable is required'),
  network: z.enum(NETWORKS, {
    errorMap: () => ({ message: 'NETWORK environment variable is required' })
  }),
  rpcUrl: z.string().min(1, 'RPC_URL environment variable is required')
})

export const apiConfigSchema = z.object({
  baseUrl: z.string().min(1),
  timeout: z.number().int().positive()
})

export const loggingConfigSchema = z.object({
  level: z.enum(LOG_LEVELS),
  enableConsole: z.boolean()
})

export const appConfigSchema = z.object({
  contract: contractConfigSchema,
  api: apiConfigSchema,
  logging: loggingConfigSchema
})

export type ContractConfig = z.infer<typeof contractConfigSchema>
export type ApiConfig = z.infer<typeof apiConfigSchema>
export type LoggingConfig = z.infer<typeof loggingConfigSchema>
export type AppConfig = z.infer<typeof appConfigSchema>

/**
 * Environment variable schema for VITE_/env vars.
 * Used by the frontend env module to validate at startup.
 */
export const envSchema = z.object({
  VITE_CONTRACT_ID: z.string().min(1, 'CONTRACT_ID environment variable is required'),
  VITE_NETWORK: z.enum(NETWORKS).default('TESTNET'),
  VITE_RPC_URL: z.string().min(1, 'RPC_URL environment variable is required'),
  VITE_API_BASE_URL: z.string().min(1).default('http://localhost:3000'),
  VITE_API_TIMEOUT: z
    .string()
    .default('30000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  VITE_LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  VITE_LOG_CONSOLE: z
    .string()
    .optional()
    .transform((val) => val !== 'false')
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate the contract configuration. Preserves the original error messages
 * for required fields for backwards compatibility.
 */
export function validateContractConfig(config: ContractConfig): void {
  const result = contractConfigSchema.safeParse(config)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new Error(first?.message ?? 'Invalid contract configuration')
  }
}

/**
 * Parse and validate raw environment variables into an `Env` object.
 * Throws a descriptive error if validation fails.
 */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${messages}`)
  }
  return result.data
}

/**
 * Build an `AppConfig` from a validated `Env` object.
 */
export function buildConfig(env: Env): AppConfig {
  return {
    contract: {
      contractId: env.VITE_CONTRACT_ID,
      network: env.VITE_NETWORK,
      rpcUrl: env.VITE_RPC_URL
    },
    api: {
      baseUrl: env.VITE_API_BASE_URL,
      timeout: env.VITE_API_TIMEOUT
    },
    logging: {
      level: env.VITE_LOG_LEVEL,
      enableConsole: env.VITE_LOG_CONSOLE
    }
  }
}

/**
 * Load and validate configuration from `import.meta.env`.
 * Kept for backwards compatibility with existing callers.
 */
export function loadConfig(): AppConfig {
  const env = parseEnv(import.meta.env as unknown as Record<string, unknown>)
  const config = buildConfig(env)
  validateContractConfig(config.contract)
  return config
}
