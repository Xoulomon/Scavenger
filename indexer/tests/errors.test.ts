/**
 * Error taxonomy tests for the indexer.
 *
 * The "wire code alignment" section pins the exact string values of each
 * ErrorCode variant. If a code value drifts from the backend taxonomy, these
 * assertions catch it immediately.
 *
 * Canonical reference: docs/ERROR_CONTRACT.md
 */

import {
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  NetworkError,
  UnauthorizedError,
  RateLimitError,
  ErrorCode,
  isAppError,
  handleError,
} from '../src/errors';

// ── Wire code alignment ───────────────────────────────────────────────────────

describe('ErrorCode wire values (backend alignment)', () => {
  it('VALIDATION_ERROR maps to validation.field_error', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('validation.field_error');
  });

  it('DATABASE_ERROR maps to database.query_failed', () => {
    expect(ErrorCode.DATABASE_ERROR).toBe('database.query_failed');
  });

  it('NETWORK_ERROR maps to network.connection_failed', () => {
    expect(ErrorCode.NETWORK_ERROR).toBe('network.connection_failed');
  });

  it('NOT_FOUND maps to not_found.resource', () => {
    expect(ErrorCode.NOT_FOUND).toBe('not_found.resource');
  });

  it('UNAUTHORIZED maps to auth.unauthorized', () => {
    expect(ErrorCode.UNAUTHORIZED).toBe('auth.unauthorized');
  });

  it('RATE_LIMIT_EXCEEDED maps to rate_limit.exceeded', () => {
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('rate_limit.exceeded');
  });

  it('INTERNAL_ERROR maps to internal', () => {
    expect(ErrorCode.INTERNAL_ERROR).toBe('internal');
  });
});

// ── Class behaviour ───────────────────────────────────────────────────────────

describe('Error Handling', () => {
  it('should create validation error', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'email' });
    expect(error.name).toBe('ValidationError');
  });

  it('should create database error', () => {
    const error = new DatabaseError('Connection failed');
    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('DatabaseError');
  });

  it('should create not found error', () => {
    const error = new NotFoundError('Participant', 'ABC123');
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('ABC123');
    expect(error.name).toBe('NotFoundError');
  });

  it('not found error without id omits id from message', () => {
    const error = new NotFoundError('Incentive');
    expect(error.message).toBe('Incentive not found');
  });

  it('should create network error', () => {
    const error = new NetworkError('Connection timeout');
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.statusCode).toBe(503);
    expect(error.name).toBe('NetworkError');
  });

  it('should create unauthorized error', () => {
    const error = new UnauthorizedError();
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should create rate limit error', () => {
    const error = new RateLimitError('Rate limit exceeded', { retryAfter: 60 });
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(429);
    expect(error.details).toEqual({ retryAfter: 60 });
    expect(error.name).toBe('RateLimitError');
  });

  it('should identify app errors', () => {
    const appError = new ValidationError('Test');
    const regularError = new Error('Test');

    expect(isAppError(appError)).toBe(true);
    expect(isAppError(regularError)).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });

  it('instanceof check works across subclasses', () => {
    const e = new UnauthorizedError();
    expect(e instanceof AppError).toBe(true);
    expect(e instanceof UnauthorizedError).toBe(true);
    expect(isAppError(e)).toBe(true);
  });

  it('should handle ECONNREFUSED as NetworkError', () => {
    const error = new Error('ECONNREFUSED');
    const handled = handleError(error);

    expect(isAppError(handled)).toBe(true);
    expect(handled.code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('should handle timeout as NetworkError', () => {
    const error = new Error('Request timeout exceeded');
    const handled = handleError(error);

    expect(handled.code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('should pass through existing AppError unchanged', () => {
    const original = new DatabaseError('already wrapped');
    const handled = handleError(original);
    expect(handled).toBe(original);
  });

  it('should handle unknown errors', () => {
    const handled = handleError('unknown');
    expect(handled.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('should serialize to JSON correctly', () => {
    const error = new ValidationError('Test error', { field: 'name' });
    const json = error.toJSON();

    expect(json.code).toBe('validation.field_error');
    expect(json.statusCode).toBe(400);
    expect(json.message).toBe('Test error');
    expect(json.details).toEqual({ field: 'name' });
  });
});
