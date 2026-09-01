# Error Message Style Guide

## Overview
This document defines the style guide for error messages in the Scavenger project.

## Message Format

### User-Facing Error Messages

#### Format
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "ERROR",
  "context": "UserService",
  "message": "Failed to create user",
  "data": {
    "userId": "123",
    "error": "ValidationError",
    "field": "email"
  }
}
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "WARN",
  "context": "AuthMiddleware",
  "message": "Authentication failed due to expired token",
  "data": {
    "userId": "123",
    "tokenExpiry": "2024-01-01T00:00:00.000Z"
  }
}
export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
}
export const createError = {
  validation: (field: string, reason: string) => {
    return new AppError(
      `Failed to validate ${field}. ${reason}`,
      'VAL-001',
      400,
      { field, reason }
    );
  },
  notFound: (resource: string, id?: string) => {
    return new AppError(
      `${resource} not found${id ? `: ${id}` : ''}`,
      'NOTF-001',
      404,
      { resource, id }
    );
  },
  unauthorized: (action: string) => {
    return new AppError(
      `Unauthorized: ${action} requires authentication`,
      'AUTH-001',
      401,
      { action }
    );
  },
};
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // Unknown error
  console.error(err);
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
    code: 'SRV-001',
  });
};
// .eslintrc.js
module.exports = {
  rules: {
    'custom/error-message-format': ['error', {
      pattern: /^[A-Z].*\.$/,
    }],
    'custom/no-vague-error-messages': 'error',
  },
};
// scripts/validate-error-messages.ts
const validateMessages = (file: string) => {
  // Check for vague messages
  const vaguePatterns = [
    /error/i,
    /something went wrong/i,
    /failed/i,
    /unexpected/i,
  ];

  // Validate message format
  const formatPattern = /^[A-Z][a-zA-Z0-9\s,'".?!-]*\.$/;
};
