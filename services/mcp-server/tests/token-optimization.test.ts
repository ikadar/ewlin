import { describe, it, expect } from 'vitest';
import {
  truncateToolResult,
  trimConversation,
  resolveModel,
  MAX_TOOL_RESULT_CHARS,
  MAX_CONVERSATION_MESSAGES,
} from '../src/llm/client.js';
import type Anthropic from '@anthropic-ai/sdk';

describe('truncateToolResult', () => {
  it('returns short content unchanged', () => {
    const content = '{"stations": []}';
    expect(truncateToolResult(content)).toBe(content);
  });

  it('returns content at exact limit unchanged', () => {
    const content = 'x'.repeat(MAX_TOOL_RESULT_CHARS);
    expect(truncateToolResult(content)).toBe(content);
  });

  it('truncates content exceeding limit', () => {
    const content = 'x'.repeat(MAX_TOOL_RESULT_CHARS + 500);
    const result = truncateToolResult(content);

    expect(result.length).toBeLessThan(content.length);
    expect(result).toContain('...[truncated');
    expect(result).toContain('500 chars omitted');
  });

  it('truncates large JSON payloads', () => {
    const jobs = Array.from({ length: 200 }, (_, i) => ({
      id: `job-${i}`,
      reference: `REF-${i}`,
      client: `Client ${i}`,
      status: 'planned',
      tasks: Array.from({ length: 5 }, (_, j) => ({
        id: `task-${i}-${j}`,
        stationId: `station-${j}`,
        runMinutes: 60,
      })),
    }));
    const content = JSON.stringify(jobs);

    expect(content.length).toBeGreaterThan(MAX_TOOL_RESULT_CHARS);

    const result = truncateToolResult(content);
    expect(result.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 100); // +100 for truncation notice
    expect(result).toContain('...[truncated');
  });
});

describe('trimConversation', () => {
  function makeMessages(count: number): Anthropic.MessageParam[] {
    return Array.from({ length: count }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
    }));
  }

  it('returns short conversations unchanged', () => {
    const messages = makeMessages(5);
    expect(trimConversation(messages)).toHaveLength(5);
  });

  it('returns conversations at exact limit unchanged', () => {
    const messages = makeMessages(MAX_CONVERSATION_MESSAGES);
    expect(trimConversation(messages)).toHaveLength(MAX_CONVERSATION_MESSAGES);
  });

  it('trims conversations exceeding limit', () => {
    const messages = makeMessages(40);
    const trimmed = trimConversation(messages);

    expect(trimmed).toHaveLength(MAX_CONVERSATION_MESSAGES);
  });

  it('preserves first message for context', () => {
    const messages = makeMessages(40);
    const trimmed = trimConversation(messages);

    expect(trimmed[0]).toEqual(messages[0]);
  });

  it('preserves most recent messages', () => {
    const messages = makeMessages(40);
    const trimmed = trimConversation(messages);

    // Last message should be preserved
    expect(trimmed[trimmed.length - 1]).toEqual(messages[messages.length - 1]);
  });
});

describe('Default model', () => {
  it('defaults to haiku when no model specified', () => {
    expect(resolveModel(undefined)).toBe('claude-haiku-4-5-20251001');
  });

  it('defaults to haiku for unknown model', () => {
    expect(resolveModel('gpt-4')).toBe('claude-haiku-4-5-20251001');
  });

  it('sonnet is still available when explicitly selected', () => {
    expect(resolveModel('sonnet')).toBe('claude-sonnet-4-20250514');
  });
});

describe('Constants', () => {
  it('MAX_CONVERSATION_MESSAGES is 12', () => {
    expect(MAX_CONVERSATION_MESSAGES).toBe(12);
  });

  it('MAX_TOOL_RESULT_CHARS is 2000', () => {
    expect(MAX_TOOL_RESULT_CHARS).toBe(2000);
  });
});
