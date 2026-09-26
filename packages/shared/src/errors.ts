/**
 * Error message utilities
 * Enforces consistent error message format
 */

export type ErrorCode =
  | 'AUTH-001'
  | 'AUTH-002'
  | 'VAL-001'
  | 'VAL-002'
  | 'DB-001'
  | 'DB-002'
  | 'SRV-001'
  | 'NOTF-001'
  | 'PERM-001'
  | 'RATE-001';

export interface ErrorResponse {
  error: string;
  message: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, statusCode: number, details?: Record<string, unknown>) {
    const formattedMessage = formatErrorMessage(message);
    super(formattedMessage);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
}

export function formatErrorMessage(message: string): string {
  let formatted = message.trim();
  
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  
  if (formatted.length > 0 && !formatted.endsWith('.')) {
    formatted += '.';
  }
  
  return formatted;
}

export function createValidationError(field: string, reason: string): AppError {
  return new AppError(
    `Failed to validate ${field}. ${reason}`,
    'VAL-001',
    400,
    { field, reason }
  );
}

export function createNotFoundError(resource: string, id?: string): AppError {
  const message = id 
    ? `${resource} not found: ${id}`
    : `${resource} not found`;
  return new AppError(message, 'NOTF-001', 404, { resource, id });
}

export function createAuthError(action: string): AppError {
  return new AppError(
    `Unauthorized: ${action} requires authentication`,
    'AUTH-001',
    401,
    { action }
  );
}

export function createPermissionError(action: string, requiredRole: string): AppError {
  return new AppError(
    `Permission denied. ${action} requires ${requiredRole} role.`,
    'PERM-001',
    403,
    { action, requiredRole }
  );
}

export function createDatabaseError(operation: string): AppError {
  return new AppError(
    `Database operation failed: ${operation}. Please try again later.`,
    'DB-001',
    500,
    { operation }
  );
}

export function createRateLimitError(limit: number, retryAfter: number): AppError {
  return new AppError(
    `Rate limit exceeded. Maximum ${limit} requests allowed. Try again in ${retryAfter} seconds.`,
    'RATE-001',
    429,
    { limit, retryAfter }
  );
}

export function formatErrorResponse(error: AppError): ErrorResponse {
  return {
    error: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
  };
}

/** Express-compatible error handler. The `req`, `res`, and `next` parameters
 *  intentionally use loose types to avoid a hard dependency on `@types/express`.
 *  eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express middleware
 *  signature requires `any` for framework-agnostic compatibility. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- framework-agnostic Express middleware signature
export function errorHandler(err: Error, req: unknown, res: any, _next: unknown): void {
  if (err instanceof AppError) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    res.status(err.statusCode).json(formatErrorResponse(err));
    return;
  }

  console.error('Unhandled error:', err);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
    code: 'SRV-001',
  });
}

export function validateErrorMessage(message: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (message.length === 0) {
    issues.push('Message cannot be empty');
  }
  
  if (message.length > 0 && message[0] !== message[0].toUpperCase()) {
    issues.push('Message must start with a capital letter');
  }
  
  if (message.length > 0 && !message.endsWith('.')) {
    issues.push('Message must end with a period');
  }
  
  const vaguePatterns = [
    /\berror\b/i,
    /\bsomething went wrong\b/i,
    /\bunexpected\b/i,
    /\bfailed\b/i,
  ];
  
  for (const pattern of vaguePatterns) {
    if (pattern.test(message) && message.length < 30) {
      issues.push('Message may be too vague');
      break;
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
