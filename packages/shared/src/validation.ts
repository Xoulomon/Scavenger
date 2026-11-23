import { z } from 'zod'

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address)
}

export const WASTE_TYPES = [
  'Paper',
  'Plastic',
  'Metal',
  'Glass',
  'Organic',
  'Electronic',
  'PetPlastic'
] as const

export type WasteType = (typeof WASTE_TYPES)[number]

export function isValidWasteType(type: string): type is WasteType {
  return (WASTE_TYPES as readonly string[]).includes(type)
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function parsePositiveInt(value: string, defaultValue: number): number {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) || parsed < 0 ? defaultValue : parsed
}

// ---------------------------------------------------------------------------
// Shared zod schemas
// ---------------------------------------------------------------------------

export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

export const stellarAddressSchema = z.string().regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address')

export const wasteTypeSchema = z.enum(WASTE_TYPES)

export type EthereumAddress = z.infer<typeof ethereumAddressSchema>
export type StellarAddress = z.infer<typeof stellarAddressSchema>

/**
 * Schema for frontend environment configuration.
 *
 * All VITE_ prefixed variables are surfaced as strings by Vite. Optional
 * variables may be omitted; defaults are applied where sensible.
 */
export const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
  VITE_STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'futurenet']).default('testnet'),
  VITE_STELLAR_HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  VITE_CONTRACT_ID: z.string().min(1).optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_ENABLE_ANALYTICS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true')
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * Parse and validate an environment record. Throws a ZodError with a
 * human-readable message when validation fails.
 */
export function parseEnv(env: Record<string, string | undefined>): EnvConfig {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  return result.data
}
