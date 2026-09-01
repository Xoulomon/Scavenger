/**
 * Centralised error handling for the indexer.
 *
 * Error codes use dot-notation (`<category>.<variant>`) to stay conceptually
 * aligned with the backend's error taxonomy (see `backend/src/errors/codes.rs`).
 * The enum *keys* are SCREAMING_SNAKE_CASE for TypeScript ergonomics; the
 * *string values* are the canonical wire codes shared across the stack.
 *
 * Canonical code table (also documented in docs/ERROR_CONTRACT.md):
 *
 * | Code                         | HTTP | Description                        |
 * |------------------------------|------|------------------------------------|
 * | validation.field_error       | 400  | Input validation failure           |
 * | database.query_failed        | 500  | DB query / connection error        |
 * | network.connection_failed    | 503  | Upstream network unreachable       |
 * | not_found.resource           | 404  | Requested resource not found       |
 * | auth.unauthorized            | 401  | Missing or invalid credentials     |
 * | rate_limit.exceeded          | 429  | Too many requests                  |
 * | internal                     | 500  | Unexpected server error            |
 */

// ── Error code registry ───────────────────────────────────────────────────────

/** Canonical dot-notation wire codes shared with the backend. */
export enum ErrorCode {
  // Validation
  VALIDATION_ERROR = 'validation.field_error',

  // Database / persistence
  DATABASE_ERROR = 'database.query_failed',

  // Network / upstream
  NETWORK_ERROR = 'network.connection_failed',

  // Resource lookup
  NOT_FOUND = 'not_found.resource',

  // Authentication / authorisation
  UNAUTHORIZED = 'auth.unauthorized',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit.exceeded',

  // Catch-all
  INTERNAL_ERROR = 'internal',
}

// ── Base error class ──────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ── Typed subclasses ──────────────────────────────────────────────────────────

/** Input validation failure (HTTP 400). */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

/** Database query or connection error (HTTP 500). */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.DATABASE_ERROR, message, 500, details);
    this.name = 'DatabaseError';
  }
}

/** Requested resource does not exist (HTTP 404). */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

/** Upstream network unreachable or timed out (HTTP 503). */
export class NetworkError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.NETWORK_ERROR, message, 503, details);
    this.name = 'NetworkError';
  }
}

/** Missing or invalid authentication credentials (HTTP 401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
    this.name = 'UnauthorizedError';
  }
}

/** Rate limit exceeded (HTTP 429). */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429, details);
    this.name = 'RateLimitError';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Narrows an unknown value to `AppError`. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Wraps an arbitrary caught value in a typed `AppError`.
 *
 * Heuristics applied (in order):
 *  - Already an `AppError` → returned as-is.
 *  - `ECONNREFUSED` or `timeout` in the message → `NetworkError`.
 *  - Any other `Error` → `AppError(INTERNAL_ERROR)`.
 *  - Anything else → `AppError(INTERNAL_ERROR, 'Unknown error occurred')`.
 */
export function handleError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED')) {
      return new NetworkError('Failed to connect to database');
    }
    if (error.message.toLowerCase().includes('timeout')) {
      return new NetworkError('Request timeout');
    }
    return new AppError(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }

  return new AppError(ErrorCode.INTERNAL_ERROR, 'Unknown error occurred', 500);
}
