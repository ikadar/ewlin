import type { Request, Response, NextFunction } from 'express';

export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

const defaultLogger = (entry: LogEntry): void => {
  console.log(
    `[${entry.timestamp}] ${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms`
  );
};

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    defaultLogger({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
