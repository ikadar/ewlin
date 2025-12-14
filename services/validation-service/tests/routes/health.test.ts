import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('Health Route', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return 200 status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should return status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.body.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include service name', async () => {
      const response = await request(app).get('/health');

      expect(response.body.service).toBe('validation-service');
    });

    it('should include version', async () => {
      const response = await request(app).get('/health');

      expect(response.body.version).toBe('0.2.7');
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown');

      expect(response.status).toBe(404);
    });

    it('should return JSON error for unknown routes', async () => {
      const response = await request(app).get('/unknown');

      expect(response.body.error).toBe('NotFound');
      expect(response.body.message).toContain('/unknown');
    });

    it('should return 404 for POST to unknown routes', async () => {
      const response = await request(app).post('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('POST');
    });
  });
});
