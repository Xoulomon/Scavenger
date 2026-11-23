// frontend/src/services/apiClient.ts

/**
 * Centralized typed HTTP client.
 *
 * This module is the canonical replacement for ad-hoc `fetch` calls across the
 * frontend. It provides:
 *  - Generic request/response typing
 *  - Base URL resolution from configuration
 *  - Auth header injection
 *  - Request timeouts (via AbortController)
 *  - JSON parsing and error mapping
 *
 * A shared `apiClient` singleton is exported for convenience, along with a
 * `createApiClient` factory for callers that need a custom configuration
 * (e.g. tests or alternative backends).
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface ApiClientConfig {
  /** Base URL prepended to every request path. Defaults to config resolution. */
  baseUrl?: string
  /** Default headers applied to every request. */
  headers?: Record<string, string>
  /** Default timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number
  /**
   * Returns the current auth token (or null/undefined if unauthenticated).
   * When provided, the token is injected as a Bearer Authorization header.
   */
  getAuthToken?: () => string | null | undefined
  /** Custom fetch implementation (useful for testing). Defaults to global fetch. */
  fetchImpl?: typeof fetch
}

export interface RequestOptions<TBody = unknown> {
  /** HTTP method. Defaults to GET (or POST when a body is provided). */
  method?: HttpMethod
  /** Request body. Serialized as JSON unless it is a FormData/Blob/string. */
  body?: TBody
  /** Additional headers merged over the client defaults. */
  headers?: Record<string, string>
  /** Query string parameters appended to the path. */
  query?: Record<string, string | number | boolean | null | undefined>
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number
  /** AbortSignal to allow external cancellation. */
  signal?: AbortSignal
  /** Skip auth header injection for this request. */
  skipAuth?: boolean
}

export interface ApiResponse<TData = unknown> {
  data: TData
  status: number
  headers: Headers
  ok: boolean
}

export type ApiErrorKind = 'network' | 'timeout' | 'aborted' | 'http' | 'parse' | 'unknown'

/**
 * Normalized error thrown by the API client. Callers can inspect `kind`,
 * `status`, and `body` to render appropriate UI or retry logic.
 */
export class ApiError<TBody = unknown> extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly body?: TBody
  readonly url?: string
  readonly cause?: unknown

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind
      status?: number
      body?: TBody
      url?: string
      cause?: unknown
    }
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status
    this.body = options.body
    this.url = options.url
    this.cause = options.cause
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Resolve the base URL from common configuration sources.
 * Prefers an explicit config value, then Vite/Webpack env vars, then a
 * relative base (empty string) so requests hit the same origin.
 */
function resolveBaseUrl(explicit?: string): string {
  if (explicit !== undefined) {
    return explicit.replace(/\/+$/, '')
  }

  // Vite exposes import.meta.env; guard for non-Vite environments.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any
    const envUrl = meta?.env?.VITE_API_BASE_URL ?? meta?.env?.VITE_API_URL
    if (typeof envUrl === 'string' && envUrl.length > 0) {
      return envUrl.replace(/\/+$/, '')
    }
  } catch {
    // import.meta may be unavailable in some test runners.
  }

  // Fallback to process.env for Node/Jest environments.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = (globalThis as any)?.process
    const envUrl = proc?.env?.REACT_APP_API_BASE_URL ?? proc?.env?.API_BASE_URL
    if (typeof envUrl === 'string' && envUrl.length > 0) {
      return envUrl.replace(/\/+$/, '')
    }
  } catch {
    // ignore
  }

  return ''
}

function buildQueryString(
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    params.append(key, String(value))
  }
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

function isJsonSerializableBody(body: unknown): boolean {
  if (body === undefined || body === null) return false
  if (typeof body === 'string') return false
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return false
  return true
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const text = await response.text()
    if (!text) return undefined
    try {
      return JSON.parse(text)
    } catch (err) {
      throw new ApiError('Failed to parse JSON response', {
        kind: 'parse',
        status: response.status,
        cause: err
      })
    }
  }
  // Fall back to text for non-JSON payloads.
  const text = await response.text()
  return text.length > 0 ? text : undefined
}

export interface ApiClient {
  request<TData = unknown, TBody = unknown>(
    path: string,
    options?: RequestOptions<TBody>
  ): Promise<ApiResponse<TData>>
  get<TData = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<TData>>
  post<TData = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'method' | 'body'>
  ): Promise<ApiResponse<TData>>
  put<TData = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'method' | 'body'>
  ): Promise<ApiResponse<TData>>
  patch<TData = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'method' | 'body'>
  ): Promise<ApiResponse<TData>>
  delete<TData = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<TData>>
  /** The resolved base URL for this client instance. */
  readonly baseUrl: string
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const baseUrl = resolveBaseUrl(config.baseUrl)
  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(config.headers ?? {})
  }
  const defaultTimeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const getAuthToken = config.getAuthToken
  const fetchImpl: typeof fetch = config.fetchImpl ?? ((...args) => globalThis.fetch(...args))

  async function request<TData = unknown, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody> = {}
  ): Promise<ApiResponse<TData>> {
    const method: HttpMethod = options.method ?? (options.body !== undefined ? 'POST' : 'GET')

    const url = `${baseUrl}${path}${buildQueryString(options.query)}`

    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...(options.headers ?? {})
    }

    // Inject auth header unless explicitly skipped.
    if (!options.skipAuth && getAuthToken) {
      const token = getAuthToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
    }

    let requestBody: BodyInit | undefined
    if (options.body !== undefined) {
      if (isJsonSerializableBody(options.body)) {
        requestBody = JSON.stringify(options.body)
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json'
        }
      } else {
        requestBody = options.body as unknown as BodyInit
      }
    }

    // Set up timeout + external abort signal.
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
    const controller = new AbortController()
    let timedOut = false
    const timeoutId =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true
            controller.abort()
          }, timeoutMs)
        : undefined

    const externalSignal = options.signal
    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort()
      } else {
        externalSignal.addEventListener('abort', onExternalAbort)
      }
    }

    let response: Response
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal
      })
    } catch (err) {
      if (timedOut) {
        throw new ApiError(`Request timed out after ${timeoutMs}ms`, {
          kind: 'timeout',
          url,
          cause: err
        })
      }
      if (externalSignal?.aborted) {
        throw new ApiError('Request aborted', {
          kind: 'aborted',
          url,
          cause: err
        })
      }
      throw new ApiError('Network request failed', {
        kind: 'network',
        url,
        cause: err
      })
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    }

    let parsed: unknown
    try {
      parsed = await parseResponseBody(response)
    } catch (err) {
      if (err instanceof ApiError) {
        throw new ApiError(err.message, {
          kind: err.kind,
          status: response.status,
          body: err.body,
          url,
          cause: err.cause
        })
      }
      throw new ApiError('Failed to read response body', {
        kind: 'parse',
        status: response.status,
        url,
        cause: err
      })
    }

    if (!response.ok) {
      const message =
        (parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : undefined) ?? `Request failed with status ${response.status}`
      throw new ApiError(message, {
        kind: 'http',
        status: response.status,
        body: parsed,
        url
      })
    }

    return {
      data: parsed as TData,
      status: response.status,
      headers: response.headers,
      ok: response.ok
    }
  }

  return {
    baseUrl,
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' })
  }
}

/**
 * Default auth token resolver. Reads from localStorage when available so the
 * singleton works without explicit configuration. Callers can override this
 * via `createApiClient` when integrating with a different auth store.
 */
function defaultGetAuthToken(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('auth_token') ?? localStorage.getItem('token') ?? null
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode).
  }
  return null
}

/**
 * Shared singleton client. Import this for typical usage:
 *
 *   import { apiClient } from '@/services/apiClient';
 *   const { data } = await apiClient.get<User[]>('/users');
 */
export const apiClient: ApiClient = createApiClient({
  getAuthToken: defaultGetAuthToken
})

export default apiClient
