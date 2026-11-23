import { ERROR_MESSAGES } from '../lib/contractErrors'

/**
 * Stable error codes used across the frontend.
 */
export type AppErrorCode =
  'NETWORK_ERROR' | 'TIMEOUT' | 'HTTP_ERROR' | 'CONTRACT_ERROR' | 'PARSE_ERROR' | 'UNKNOWN_ERROR'

/**
 * Normalized application error shape.
 * All API/service errors should be mapped to this type before surfacing to UI.
 */
export interface AppError {
  /** Stable machine-readable code. */
  code: AppErrorCode
  /** User-facing message (safe to display). */
  message: string
  /** HTTP status code, when applicable. */
  status?: number
  /** Original error, preserved for logging/debugging. */
  cause?: unknown
  /** Optional additional context (e.g. contract error code). */
  details?: Record<string, unknown>
}

/**
 * Shape of errors thrown by the contract layer (see lib/contractErrors.ts).
 */
interface ContractErrorLike {
  code?: string
  message?: string
  name?: string
}

const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT: 'The request timed out. Please try again.',
  HTTP_ERROR: 'Something went wrong while processing your request.',
  CONTRACT_ERROR: 'A contract error occurred. Please try again.',
  PARSE_ERROR: 'Received an invalid response from the server.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
}

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was invalid. Please check your input.',
  401: 'You are not authorized. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'The request timed out. Please try again.',
  409: 'There was a conflict with the current state. Please refresh and try again.',
  422: 'The submitted data could not be processed.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'The server is temporarily unavailable. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
  504: 'The server took too long to respond. Please try again later.'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAppError(value: unknown): value is AppError {
  return (
    isObject(value) &&
    typeof (value as AppError).code === 'string' &&
    typeof (value as AppError).message === 'string' &&
    (value as AppError).code in DEFAULT_MESSAGES
  )
}

function isContractError(value: unknown): value is ContractErrorLike {
  if (!isObject(value)) return false
  const code = (value as ContractErrorLike).code
  return typeof code === 'string' && code in ERROR_MESSAGES
}

function isAbortError(value: unknown): boolean {
  return isObject(value) && (value as { name?: string }).name === 'AbortError'
}

function isTimeoutError(value: unknown): boolean {
  return isObject(value) && (value as { name?: string }).name === 'TimeoutError'
}

function isTypeError(value: unknown): boolean {
  return value instanceof TypeError
}

function getContractMessage(code: string): string {
  const messages = ERROR_MESSAGES as Record<string, string | undefined>
  return messages[code] ?? DEFAULT_MESSAGES.CONTRACT_ERROR
}

function getHttpMessage(status: number): string {
  return HTTP_STATUS_MESSAGES[status] ?? DEFAULT_MESSAGES.HTTP_ERROR
}

/**
 * Normalize any thrown value into a stable {@link AppError}.
 *
 * Handles:
 * - Already-normalized {@link AppError} instances (returned as-is)
 * - Contract errors (mapped via ERROR_MESSAGES)
 * - HTTP errors (objects with a numeric `status`)
 * - Network failures (fetch TypeError)
 * - Timeout / abort errors
 * - JSON parse errors
 * - Anything else (UNKNOWN_ERROR)
 */
export function mapError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  // Contract errors from lib/contractErrors.ts
  if (isContractError(error)) {
    const code = (error as ContractErrorLike).code as string
    return {
      code: 'CONTRACT_ERROR',
      message: getContractMessage(code),
      cause: error,
      details: { contractCode: code }
    }
  }

  // Timeout / abort
  if (isTimeoutError(error)) {
    return {
      code: 'TIMEOUT',
      message: DEFAULT_MESSAGES.TIMEOUT,
      cause: error
    }
  }

  if (isAbortError(error)) {
    return {
      code: 'NETWORK_ERROR',
      message: 'The request was cancelled.',
      cause: error
    }
  }

  // HTTP errors: objects carrying a numeric status
  if (isObject(error) && typeof (error as { status?: unknown }).status === 'number') {
    const status = (error as { status: number }).status
    const explicitMessage =
      typeof (error as { message?: unknown }).message === 'string' &&
      (error as { message: string }).message.trim().length > 0
        ? (error as { message: string }).message
        : undefined

    return {
      code: 'HTTP_ERROR',
      message: explicitMessage ?? getHttpMessage(status),
      status,
      cause: error
    }
  }

  // Network failures surface as TypeError from fetch
  if (isTypeError(error)) {
    return {
      code: 'NETWORK_ERROR',
      message: DEFAULT_MESSAGES.NETWORK_ERROR,
      cause: error
    }
  }

  // JSON parse errors
  if (error instanceof SyntaxError) {
    return {
      code: 'PARSE_ERROR',
      message: DEFAULT_MESSAGES.PARSE_ERROR,
      cause: error
    }
  }

  // Plain Error with a message
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || DEFAULT_MESSAGES.UNKNOWN_ERROR,
      cause: error
    }
  }

  // String thrown
  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error,
      cause: error
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: DEFAULT_MESSAGES.UNKNOWN_ERROR,
    cause: error
  }
}

/**
 * Extract a user-facing message from any error.
 * Re-exported for backwards compatibility with existing callers.
 */
export function getErrorMessage(error: unknown): string {
  return mapError(error).message
}

export default mapError
