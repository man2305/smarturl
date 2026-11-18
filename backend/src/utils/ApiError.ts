/**
 * Custom operational error class.
 * `isOperational` lets the centralized handler distinguish expected
 * business failures (4xx) from programming errors (500).
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors?: unknown;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, errors?: unknown, isOperational = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors?: unknown): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict'): ApiError {
    return new ApiError(409, message);
  }

  static internal(message = 'Internal server error'): ApiError {
    // A 500 is a programming/infra error, not an expected business failure.
    return new ApiError(500, message, undefined, false);
  }
}
