import { describe, it, expect, vi } from 'vitest';
import { createLoggerMiddleware, type LogEntry } from '../../src/middleware/logger.js';
import type { Request, Response, NextFunction } from 'express';

describe('Logger Middleware', () => {
  function createMockRequest(overrides: Partial<Request> = {}): Request {
    return {
      method: 'GET',
      path: '/test',
      ...overrides,
    } as Request;
  }

  function createMockResponse(): Response {
    const handlers: Record<string, (() => void)[]> = {};
    return {
      statusCode: 200,
      on: (event: string, handler: () => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      },
      emit: (event: string) => {
        handlers[event]?.forEach((h) => h());
      },
    } as unknown as Response;
  }

  it('should call next function', () => {
    const middleware = createLoggerMiddleware(() => {});
    const next: NextFunction = vi.fn();

    middleware(createMockRequest(), createMockResponse(), next);

    expect(next).toHaveBeenCalled();
  });

  it('should log request on response finish', () => {
    const logEntries: LogEntry[] = [];
    const logger = (entry: LogEntry) => logEntries.push(entry);
    const middleware = createLoggerMiddleware(logger);

    const req = createMockRequest({ method: 'POST', path: '/api/validate' });
    const res = createMockResponse();
    res.statusCode = 201;

    middleware(req, res, () => {});

    // Simulate response finish
    (res as unknown as { emit: (event: string) => void }).emit('finish');

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].method).toBe('POST');
    expect(logEntries[0].path).toBe('/api/validate');
    expect(logEntries[0].statusCode).toBe(201);
  });

  it('should include duration in milliseconds', () => {
    const logEntries: LogEntry[] = [];
    const logger = (entry: LogEntry) => logEntries.push(entry);
    const middleware = createLoggerMiddleware(logger);

    const res = createMockResponse();
    middleware(createMockRequest(), res, () => {});

    (res as unknown as { emit: (event: string) => void }).emit('finish');

    expect(logEntries[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof logEntries[0].durationMs).toBe('number');
  });

  it('should include ISO timestamp', () => {
    const logEntries: LogEntry[] = [];
    const logger = (entry: LogEntry) => logEntries.push(entry);
    const middleware = createLoggerMiddleware(logger);

    const res = createMockResponse();
    middleware(createMockRequest(), res, () => {});

    (res as unknown as { emit: (event: string) => void }).emit('finish');

    expect(logEntries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
