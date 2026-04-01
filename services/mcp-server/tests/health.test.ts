import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resolveModel } from '../src/llm/client.js';

describe('Health endpoint', () => {
  const app = createApp();

  it('returns 200 with service info', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('mcp-server');
    expect(res.body.version).toBe('0.1.0');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('CORS headers', () => {
  const app = createApp();

  it('returns CORS headers on OPTIONS', async () => {
    const res = await request(app).options('/chat');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

describe('Chat endpoint validation', () => {
  const app = createApp();

  it('returns 400 for empty message', async () => {
    const res = await request(app).post('/chat').send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('InvalidRequest');
  });

  it('returns 400 for missing message field', async () => {
    const res = await request(app).post('/chat').send({});

    expect(res.status).toBe(400);
  });

  it('accepts valid model parameter', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'hello', model: 'haiku', conversationId: null });

    // Will fail because no ANTHROPIC_API_KEY, but should not be a 400
    expect(res.status).not.toBe(400);
  });

  it('rejects invalid model parameter', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'hello', model: 'gpt-4', conversationId: null });

    expect(res.status).toBe(400);
  });
});

describe('Model resolution', () => {
  it('resolves sonnet to claude-sonnet-4-20250514', () => {
    expect(resolveModel('sonnet')).toBe('claude-sonnet-4-20250514');
  });

  it('resolves haiku to claude-haiku-4-5-20251001', () => {
    expect(resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');
  });

  it('defaults to haiku when undefined', () => {
    expect(resolveModel(undefined)).toBe('claude-haiku-4-5-20251001');
  });

  it('defaults to haiku for unknown model', () => {
    expect(resolveModel('gpt-4')).toBe('claude-haiku-4-5-20251001');
  });
});

describe('Chat confirm/cancel', () => {
  const app = createApp();

  it('returns 404 for unknown conversation confirm', async () => {
    const res = await request(app).post('/chat/nonexistent/confirm');

    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown conversation cancel', async () => {
    const res = await request(app).post('/chat/nonexistent/cancel');

    expect(res.status).toBe(404);
  });

  it('returns 204 for deleting unknown conversation', async () => {
    const res = await request(app).delete('/chat/nonexistent');

    expect(res.status).toBe(204);
  });
});
