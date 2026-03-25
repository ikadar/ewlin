import type { Request, Response, NextFunction } from 'express';

export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

export type LoggerFunction = (entry: LogEntry) => void;

const defaultLogger: LoggerFunction = (entry) => {
  console.log(
    `[${entry.timestamp}] ${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms`
  );
};

export function createLoggerMiddleware(logger: LoggerFunction = defaultLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      };
      logger(entry);
    });

    next();
  };
}

export const loggerMiddleware = createLoggerMiddleware();
