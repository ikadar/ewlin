/**
 * Tests for mockBaseQuery.ts - Mock adapter for RTK Query
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockBaseQuery, __testing__ } from './mockBaseQuery';
import * as snapshotModule from '../../mock/snapshot';

// Mock the snapshot module
vi.mock('../../mock/snapshot', () => ({
  getSnapshot: vi.fn(),
  updateSnapshot: vi.fn(),
}));

// Mock the utils
vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'mock-id-123'),
  calculateEndTime: vi.fn((task, start) => {
    // Simple mock: add 60 minutes
    const date = new Date(start);
    date.setMinutes(date.getMinutes() + 60);
    return date.toISOString();
  }),
  applyPushDown: vi.fn((assignments, targetId, start, end, taskId) => ({
    updatedAssignments: assignments,
  })),
}));

const { extractPathParam, normalizeArgs } = __testing__;

describe('mockBaseQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('extractPathParam', () => {
    it('extracts task ID from assign URL', () => {
      const result = extractPathParam('/tasks/task-123/assign', /\/tasks\/([^/]+)\/assign/);
      expect(result).toBe('task-123');
    });

    it('extracts task ID from completion URL', () => {
      const result = extractPathParam('/tasks/task-456/completion', /\/tasks\/([^/]+)\/completion/);
      expect(result).toBe('task-456');
    });

    it('returns null for non-matching URL', () => {
      const result = extractPathParam('/other/path', /\/tasks\/([^/]+)\/assign/);
      expect(result).toBeNull();
    });
  });

  describe('normalizeArgs', () => {
    it('converts string to FetchArgs with GET method', () => {
      const result = normalizeArgs('/api/endpoint');
      expect(result).toEqual({ url: '/api/endpoint', method: 'GET' });
    });

    it('preserves FetchArgs object', () => {
      const args = { url: '/api/endpoint', method: 'POST', body: { foo: 'bar' } };
      const result = normalizeArgs(args);
      expect(result).toEqual(args);
    });

    it('defaults method to GET when not specified', () => {
      const result = normalizeArgs({ url: '/api/endpoint' });
      expect(result.method).toBe('GET');
    });
  });

  describe('route handling', () => {
    it('handles GET /schedule/snapshot', async () => {
      const mockSnapshot = {
        version: 1,
        stations: [],
        jobs: [],
        tasks: [],
        assignments: [],
      };
      vi.mocked(snapshotModule.getSnapshot).mockReturnValue(mockSnapshot as any);

      const result = await mockBaseQuery('/schedule/snapshot', {} as any, {});

      expect(result).toEqual({ data: mockSnapshot });
      expect(snapshotModule.getSnapshot).toHaveBeenCalled();
    });

    it('returns 404 for unknown routes', async () => {
      const result = await mockBaseQuery('/unknown/route', {} as any, {});

      expect(result.error).toBeDefined();
      expect((result.error as any).status).toBe(404);
    });

    it('handles POST /jobs (createJob)', async () => {
      const result = await mockBaseQuery(
        { url: '/jobs', method: 'POST', body: { reference: 'JOB-001' } },
        {} as any,
        {}
      );

      expect(result).toEqual({ data: undefined });
    });

    it('handles POST /tasks/:id/assign', async () => {
      const mockSnapshot = {
        tasks: [{ id: 'task-1', type: 'internal', setupMinutes: 10, runMinutes: 20 }],
        stations: [{ id: 'station-1' }],
        assignments: [],
      };
      vi.mocked(snapshotModule.getSnapshot).mockReturnValue(mockSnapshot as any);
      vi.mocked(snapshotModule.updateSnapshot).mockImplementation(() => {});

      const result = await mockBaseQuery(
        {
          url: '/tasks/task-1/assign',
          method: 'POST',
          body: {
            targetId: 'station-1',
            scheduledStart: '2026-02-03T10:00:00Z',
            isOutsourced: false,
          },
        },
        {} as any,
        {}
      );

      expect(result.data).toBeDefined();
      expect((result.data as any).taskId).toBe('task-1');
      expect(snapshotModule.updateSnapshot).toHaveBeenCalled();
    });

    it('returns 404 when task not found for assign', async () => {
      const mockSnapshot = {
        tasks: [],
        stations: [],
        assignments: [],
      };
      vi.mocked(snapshotModule.getSnapshot).mockReturnValue(mockSnapshot as any);

      const result = await mockBaseQuery(
        {
          url: '/tasks/nonexistent/assign',
          method: 'POST',
          body: {
            targetId: 'station-1',
            scheduledStart: '2026-02-03T10:00:00Z',
          },
        },
        {} as any,
        {}
      );

      expect(result.error).toBeDefined();
      expect((result.error as any).status).toBe(404);
    });

    it('handles DELETE /tasks/:id/assign (unassign)', async () => {
      const mockSnapshot = {
        assignments: [{ id: 'assign-1', taskId: 'task-1' }],
      };
      vi.mocked(snapshotModule.getSnapshot).mockReturnValue(mockSnapshot as any);
      vi.mocked(snapshotModule.updateSnapshot).mockImplementation(() => {});

      const result = await mockBaseQuery(
        { url: '/tasks/task-1/assign', method: 'DELETE' },
        {} as any,
        {}
      );

      expect(result.data).toBeDefined();
      expect((result.data as any).taskId).toBe('task-1');
      expect((result.data as any).status).toBe('ready');
    });

    it('handles PUT /tasks/:id/completion (toggle)', async () => {
      const mockSnapshot = {
        assignments: [
          { id: 'assign-1', taskId: 'task-1', isCompleted: false, completedAt: null },
        ],
      };
      vi.mocked(snapshotModule.getSnapshot).mockReturnValue(mockSnapshot as any);
      vi.mocked(snapshotModule.updateSnapshot).mockImplementation(() => {});

      const result = await mockBaseQuery(
        { url: '/tasks/task-1/completion', method: 'PUT' },
        {} as any,
        {}
      );

      expect(result.data).toBeDefined();
      expect((result.data as any).taskId).toBe('task-1');
      expect((result.data as any).isCompleted).toBe(true);
    });
  });
});
