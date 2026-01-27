import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Structured Error Handler
 *
 * Provides consistent error responses and logging across the API.
 */

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error implements APIError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error implements APIError {
  statusCode = 404;
  code = 'NOT_FOUND';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error implements APIError {
  statusCode = 401;
  code = 'UNAUTHORIZED';

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error implements APIError {
  statusCode = 403;
  code = 'FORBIDDEN';

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error implements APIError {
  statusCode = 409;
  code = 'CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error implements APIError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends Error implements APIError {
  statusCode = 500;
  code = 'INTERNAL_SERVER_ERROR';

  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

/**
 * Express error handler middleware
 *
 * Should be registered AFTER all routes.
 */
export function errorHandler(
  err: APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error with context
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
    },
  }, 'Request error');

  // Determine status code
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  // Prepare response
  const response: any = {
    error: err.message || 'An unexpected error occurred',
    code,
    timestamp: new Date().toISOString(),
  };

  // Add details for validation errors
  if (err instanceof ValidationError && err.details) {
    response.details = err.details;
  }

  // Add request ID if available
  if (req.headers['x-request-id']) {
    response.requestId = req.headers['x-request-id'];
  }

  // Don't leak internal error details in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    response.error = 'Internal server error';
    // But log the full error
    logger.error({ err }, 'Unhandled internal error');
  }

  res.status(statusCode).json(response);
}

/**
 * Async route handler wrapper
 *
 * Catches async errors and passes them to error handling middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler
 *
 * Should be registered after all routes but before error handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.path}`);
  next(error);
}
