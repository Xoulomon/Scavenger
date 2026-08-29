/**
 * validation/index.ts – lightweight runtime input validation utilities.
 *
 * This module provides a simple schema-based validator so that every route
 * can declare and enforce its inputs without pulling in a full validation
 * library. The API mirrors common patterns (field, type, constraint) and
 * produces a consistent 400 error shape.
 */

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class RequestValidationError extends Error {
  public readonly details: ValidationErrorDetail[];

  constructor(details: ValidationErrorDetail[]) {
    const summary = details.map(d => `${d.field}: ${d.message}`).join('; ');
    super(`Validation failed – ${summary}`);
    this.name = 'RequestValidationError';
    this.details = details;
  }

  /** Standard 400 response body */
  toResponse(): { error: string; details: ValidationErrorDetail[] } {
    return { error: this.message, details: this.details };
  }
}

// ── Validators ───────────────────────────────────────────────────────────────

/** Validate an optional integer query parameter. Returns the parsed value or undefined. */
export function validateOptionalInt(
  raw: string | null | undefined,
  field: string,
  opts: { min?: number; max?: number } = {}
): number | undefined {
  if (raw === null || raw === undefined || raw === '') {return undefined;}

  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new RequestValidationError([{ field, message: 'must be an integer' }]);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new RequestValidationError([
      { field, message: `must be >= ${opts.min}` },
    ]);
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new RequestValidationError([
      { field, message: `must be <= ${opts.max}` },
    ]);
  }
  return n;
}

/** Validate an optional string parameter against an allowlist. */
export function validateOptionalEnum<T extends string>(
  raw: string | null | undefined,
  field: string,
  allowed: readonly T[]
): T | undefined {
  if (raw === null || raw === undefined || raw === '') {return undefined;}
  if (!allowed.includes(raw as T)) {
    throw new RequestValidationError([
      { field, message: `must be one of: ${allowed.join(', ')}` },
    ]);
  }
  return raw as T;
}

/** Validate that a required path/body string is non-empty. */
export function validateRequiredString(
  raw: string | null | undefined,
  field: string,
  opts: { maxLength?: number } = {}
): string {
  if (raw === null || raw === undefined || raw.trim() === '') {
    throw new RequestValidationError([{ field, message: 'is required' }]);
  }
  if (opts.maxLength !== undefined && raw.length > opts.maxLength) {
    throw new RequestValidationError([
      { field, message: `must be <= ${opts.maxLength} characters` },
    ]);
  }
  return raw.trim();
}

/**
 * Validate replay request body fields.
 * Returns validated { fromLedger, toLedger?, eventTypes? } or throws.
 */
export interface ReplayBody {
  fromLedger: number;
  toLedger?: number;
  eventTypes?: string[];
}

export function validateReplayBody(raw: Record<string, unknown>): ReplayBody {
  const errors: ValidationErrorDetail[] = [];

  if (typeof raw.fromLedger !== 'number' || !Number.isInteger(raw.fromLedger) || raw.fromLedger < 0) {
    errors.push({ field: 'fromLedger', message: 'must be a non-negative integer' });
  }

  if (raw.toLedger !== undefined) {
    if (typeof raw.toLedger !== 'number' || !Number.isInteger(raw.toLedger)) {
      errors.push({ field: 'toLedger', message: 'must be an integer when provided' });
    } else if (typeof raw.fromLedger === 'number' && raw.toLedger < raw.fromLedger) {
      errors.push({ field: 'toLedger', message: 'must be >= fromLedger' });
    }
  }

  if (raw.eventTypes !== undefined) {
    if (!Array.isArray(raw.eventTypes)) {
      errors.push({ field: 'eventTypes', message: 'must be an array when provided' });
    } else if (raw.eventTypes.some(t => typeof t !== 'string')) {
      errors.push({ field: 'eventTypes', message: 'all items must be strings' });
    }
  }

  if (errors.length > 0) {throw new RequestValidationError(errors);}

  return {
    fromLedger: raw.fromLedger as number,
    toLedger: raw.toLedger as number | undefined,
    eventTypes: raw.eventTypes as string[] | undefined,
  };
}

/**
 * Validate event query parameters.
 */
export interface EventQueryParams {
  eventType?: string;
  fromLedger?: number;
  toLedger?: number;
  contractId?: string;
  txHash?: string;
  limit?: number;
  offset?: number;
}

export function validateEventQueryParams(url: URL): EventQueryParams {
  const errors: ValidationErrorDetail[] = [];
  const result: EventQueryParams = {};

  const fromLedger = url.searchParams.get('from');
  if (fromLedger !== null) {
    const n = Number(fromLedger);
    if (!Number.isInteger(n) || n < 0) {
      errors.push({ field: 'from', message: 'must be a non-negative integer' });
    } else {
      result.fromLedger = n;
    }
  }

  const toLedger = url.searchParams.get('to');
  if (toLedger !== null) {
    const n = Number(toLedger);
    if (!Number.isInteger(n) || n < 0) {
      errors.push({ field: 'to', message: 'must be a non-negative integer' });
    } else {
      result.toLedger = n;
    }
  }

  if (result.fromLedger !== undefined && result.toLedger !== undefined) {
    if (result.toLedger < result.fromLedger) {
      errors.push({ field: 'to', message: 'must be >= from' });
    }
  }

  const limit = url.searchParams.get('limit');
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      errors.push({ field: 'limit', message: 'must be an integer between 1 and 1000' });
    } else {
      result.limit = n;
    }
  }

  const offset = url.searchParams.get('offset');
  if (offset !== null) {
    const n = Number(offset);
    if (!Number.isInteger(n) || n < 0) {
      errors.push({ field: 'offset', message: 'must be a non-negative integer' });
    } else {
      result.offset = n;
    }
  }

  if (errors.length > 0) {throw new RequestValidationError(errors);}

  result.eventType = url.searchParams.get('type') ?? undefined;
  result.contractId = url.searchParams.get('contractId') ?? undefined;
  result.txHash = url.searchParams.get('txHash') ?? undefined;

  return result;
}
