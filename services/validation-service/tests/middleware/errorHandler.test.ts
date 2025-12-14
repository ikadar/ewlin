import { describe, it, expect, vi } from 'vitest';
import { errorHandler, notFoundHandler, HttpError } from '../../src/middleware/errorHandler.js';
import type { Request, Response, NextFunction } from 'express';

describe('Error Handler Middleware', () => {
  function createMockRequest(overrides: Partial<Request> = {}): Request {
    return {
      method: 'GET',
      path: '/test',
      ...overrides,
    } as Request;
  }

  function createMockResponse(): Response & { jsonData: unknown; statusValue: number } {
    const res = {
      statusValue: 200,
      jsonData: null as unknown,
      status(code: number) {
        this.statusValue = code;
        return this;
      },
      json(data: unknown) {
        this.jsonData = data;
        return this;
      },
    };
    return res as unknown as Response & { jsonData: unknown; statusValue: number };
  }

  describe('errorHandler', () => {
    it('should return JSON error response', () => {
      const res = createMockResponse();
      const err = new Error('Test error');

      errorHandler(err, createMockRequest(), res, (() => {}) as NextFunction);

      expect(res.jsonData).toHaveProperty('error');
      expect(res.jsonData).toHaveProperty('message');
      expect(res.jsonData).toHaveProperty('statusCode');
      expect(res.jsonData).toHaveProperty('timestamp');
    });

    it('should return 500 for generic errors', () => {
      const res = createMockResponse();
      const err = new Error('Generic error');

      errorHandler(err, createMockRequest(), res, (() => {}) as NextFunction);

      expect(res.statusValue).toBe(500);
      expect((res.jsonData as { statusCode: number }).statusCode).toBe(500);
      expect((res.jsonData as { error: string }).error).toBe('InternalServerError');
    });

    it('should return custom status for HttpError', () => {
      const res = createMockResponse();
      const err = new HttpError(400, 'Bad request');

      errorHandler(err, createMockRequest(), res, (() => {}) as NextFunction);

      expect(res.statusValue).toBe(400);
      expect((res.jsonData as { statusCode: number }).statusCode).toBe(400);
      expect((res.jsonData as { error: string }).error).toBe('HttpError');
    });

    it('should include error message', () => {
      const res = createMockResponse();
      const err = new Error('Specific error message');

      errorHandler(err, createMockRequest(), res, (() => {}) as NextFunction);

      expect((res.jsonData as { message: string }).message).toBe('Specific error message');
    });

    it('should include ISO timestamp', () => {
      const res = createMockResponse();
      const err = new Error('Test');

      errorHandler(err, createMockRequest(), res, (() => {}) as NextFunction);

      expect((res.jsonData as { timestamp: string }).timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 status', () => {
      const res = createMockResponse();
      const req = createMockRequest({ method: 'GET', path: '/unknown' });

      notFoundHandler(req, res);

      expect(res.statusValue).toBe(404);
    });

    it('should include route info in message', () => {
      const res = createMockResponse();
      const req = createMockRequest({ method: 'POST', path: '/api/unknown' });

      notFoundHandler(req, res);

      expect((res.jsonData as { message: string }).message).toContain('POST');
      expect((res.jsonData as { message: string }).message).toContain('/api/unknown');
    });

    it('should return NotFound error type', () => {
      const res = createMockResponse();

      notFoundHandler(createMockRequest(), res);

      expect((res.jsonData as { error: string }).error).toBe('NotFound');
    });
  });
});
