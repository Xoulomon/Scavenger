/**
 * api/httpClient.ts
 *
 * @deprecated Compatibility shim. The implementation now lives in
 * `services/apiClient.ts` (single fetch implementation) and
 * `services/errorMapper.ts` (error normalization). This module re-exports
 * the shared types and delegates to the services client so existing imports
 * keep working. Prefer importing from `services/apiClient` directly.
 *
 * Usage:
 *   const client = createApiClient({ baseUrl: 'https://api.example.com' })
 *   const wastes = await client.get<Waste[]>('/contracts/wastes')
 */

import { config } from '@/config'
import {
  ApiClient as ServicesApiClient,
  createApiClient as createServicesApiClient,
  apiClient as servicesApiClient,
  type ApiClientOptions,
  type RequestOptions,
  type ApiResult,
  type HttpMethod
} from '../services/apiClient'
import { ApiError, normalizeApiError } from '../services/errorMapper'

/* ────────────────────────────────────────────────────────────────
   Types (re-exported for backwards compatibility)
   ──────────────────────────────────────────────────────────────── */

export type { ApiClientOptions, RequestOptions, ApiResult, HttpMethod }
export { ApiError, normalizeApiError }

/**
 * Well-known HTTP status codes used by the client and its consumers.
 * Prefer these over magic numbers when branching on `ApiError.status`.
 */
export const HttpStatus = {
  Ok: 200,
  Created: 201,
  NoContent: 204,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504
} as const

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus]

/**
 * Synthetic status used for client-side failures (network errors, timeouts).
 * Kept at 0 so it never collides with a real HTTP status.
 */
export const CLIENT_ERROR_STATUS = 0

/** Machine-readable error kinds, useful for retry decisions. */
export const ApiErrorKind = {
  Timeout: 'Timeout',
  NetworkError: 'NetworkError',
  Unknown: 'Unknown',
  Http: 'Http'
} as const

export type ApiErrorKind = (typeof ApiErrorKind)[keyof typeof ApiErrorKind]

/**
 * Map an ApiError (or any thrown value) to the lifecycle status used by the
 * shared transaction-status module. Network/timeout errors (status 0) are
 * treated as failed so the UI can surface a retry affordance.
 */
export function toTransactionStatus(err: unknown): 'success' | 'failed' {
  return err === undefined || err === null ? 'success' : 'failed'
}

/* ────────────────────────────────────────────────────────────────
   Core client (thin alias of the services implementation)
   ──────────────────────────────────────────────────────────────── */

export class ApiClient extends ServicesApiClient {}

/* ────────────────────────────────────────────────────────────────
   Factory
   ──────────────────────────────────────────────────────────────── */

/**
 * Create a pre-configured ApiClient instance.
 *
 * When `baseUrl` / `timeoutMs` are omitted, the validated values from the
 * config module are used (VITE_API_BASE_URL / VITE_API_TIMEOUT_MS).
 *
 * @example
 * const api = createApiClient()
 * const result = await api.get<Waste[]>('/contracts/wastes')
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return createServicesApiClient({
    baseUrl: options.baseUrl ?? config.apiBaseUrl,
    timeoutMs: options.timeoutMs ?? config.apiTimeoutMs,
    ...options
  }) as ApiClient
}

/* ────────────────────────────────────────────────────────────────
   Shared singleton (uses validated config)
   ──────────────────────────────────────────────────────────────── */

export const apiClient: ApiClient = servicesApiClient as ApiClient

/* ────────────────────────────────────────────────────────────────
   Error normalization
   ──────────────────────────────────────────────────────────────── */

/**
 * Backwards-compatibility note: `ApiError`, `ApiClient`, `createApiClient`,
 * `apiClient` and `normalizeApiError` retain their existing signatures.
 * `toTransactionStatus` is additive and safe to adopt incrementally.
 */

/**
 * Default retry predicate for TanStack Query `retry` options.
 *
 * @example
 * useQuery({ queryKey, queryFn, retry: shouldRetryRequest })
 */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false
  return normalizeApiError(error).isRetryable
}
