import type { Request, Response, NextFunction } from 'express';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const errorName = err instanceof HttpError ? 'HttpError' : 'InternalServerError';

  const response: ErrorResponse = {
    error: errorName,
    message: err.message || 'An unexpected error occurred',
    statusCode,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
}
