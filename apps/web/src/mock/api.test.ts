/**
 * Mock API Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockApi,
  mockApi,
  simulateLatency,
  simulateFailure,
  MockApiError,
  type MockApiConfig,
  type CreateAssignmentRequest,
} from './api';
import { invalidateSnapshot } from './snapshot';

describe('Mock API', () => {
  beforeEach(() => {
    // Reset snapshot before each test
    invalidateSnapshot();
    // Reset default mockApi config
    mockApi.reset();
    mockApi.setConfig({ latencyMs: 0, latencyVariance: 0, failureRate: 0 });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('createMockApi', () => {
    it('creates an API instance with default config', () => {
      const api = createMockApi();
      const config = api.getConfig();

      expect(config.latencyMs).toBe(200);
      expect(config.latencyVariance).toBe(100);
      expect(config.failureRate).toBe(0);
    });

    it('creates an API instance with custom config', () => {
      const api = createMockApi({
        latencyMs: 500,
        latencyVariance: 50,
        failureRate: 0.1,
      });
      const config = api.getConfig();

      expect(config.latencyMs).toBe(500);
      expect(config.latencyVariance).toBe(50);
      expect(config.failureRate).toBe(0.1);
    });

    it('allows partial config override', () => {
      const api = createMockApi({ latencyMs: 300 });
      const config = api.getConfig();

      expect(config.latencyMs).toBe(300);
      expect(config.latencyVariance).toBe(100); // default
      expect(config.failureRate).toBe(0); // default
    });
  });

  describe('setConfig', () => {
    it('updates config values', () => {
      const api = createMockApi();
      api.setConfig({ latencyMs: 1000 });

      expect(api.getConfig().latencyMs).toBe(1000);
      expect(api.getConfig().latencyVariance).toBe(100); // unchanged
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('simulateLatency', () => {
    it('delays for approximately the configured time', async () => {
      const config: MockApiConfig = {
        latencyMs: 50,
        latencyVariance: 0,
        failureRate: 0,
      };

      const start = Date.now();
      await simulateLatency(config);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // allow small variance
      expect(elapsed).toBeLessThan(100);
    });

    it('adds variance to delay', async () => {
      const config: MockApiConfig = {
        latencyMs: 10,
        latencyVariance: 50,
        failureRate: 0,
      };

      const start = Date.now();
      await simulateLatency(config);
      const elapsed = Date.now() - start;

      // With 10ms base + 0-50ms variance, should be between 10-60ms
      expect(elapsed).toBeGreaterThanOrEqual(5);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('simulateFailure', () => {
    it('does not throw when failureRate is 0', () => {
      const config: MockApiConfig = {
        latencyMs: 0,
        latencyVariance: 0,
        failureRate: 0,
      };

      expect(() => simulateFailure(config)).not.toThrow();
    });

    it('throws MockApiError when failureRate is 1', () => {
      const config: MockApiConfig = {
        latencyMs: 0,
        latencyVariance: 0,
        failureRate: 1,
      };

      expect(() => simulateFailure(config)).toThrow(MockApiError);
    });

    it('throws error with correct properties', () => {
      const config: MockApiConfig = {
        latencyMs: 0,
        latencyVariance: 0,
        failureRate: 1,
      };

      try {
        simulateFailure(config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MockApiError);
        if (error instanceof MockApiError) {
          expect(error.statusCode).toBe(503);
          expect(error.code).toBe('SIMULATED_FAILURE');
        }
      }
    });
  });

  describe('MockApiError', () => {
    it('has correct default values', () => {
      const error = new MockApiError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('MOCK_API_ERROR');
      expect(error.name).toBe('MockApiError');
    });

    it('accepts custom status code and error code', () => {
      const error = new MockApiError('Not found', 404, 'NOT_FOUND');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  // ==========================================================================
  // getSnapshot Tests
  // ==========================================================================

  describe('getSnapshot', () => {
    it('returns a valid ScheduleSnapshot', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.version).toBeGreaterThanOrEqual(1);
      expect(snapshot.generatedAt).toBeDefined();
      expect(Array.isArray(snapshot.stations)).toBe(true);
      expect(Array.isArray(snapshot.jobs)).toBe(true);
      expect(Array.isArray(snapshot.tasks)).toBe(true);
      expect(Array.isArray(snapshot.assignments)).toBe(true);
    });

    it('returns the same snapshot on subsequent calls', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot1 = await api.getSnapshot();
      const snapshot2 = await api.getSnapshot();

      expect(snapshot1.generatedAt).toBe(snapshot2.generatedAt);
      expect(snapshot1.jobs.length).toBe(snapshot2.jobs.length);
    });
  });

  // ==========================================================================
  // createAssignment Tests
  // ==========================================================================

  describe('createAssignment', () => {
    it('creates a new assignment', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      // Find an unassigned task
      const unassignedTask = snapshot.tasks.find(
        (task) => !snapshot.assignments.some((a) => a.taskId === task.id)
      );

      if (!unassignedTask) {
        // All tasks assigned, skip test
        return;
      }

      const station = snapshot.stations[0];
      const request: CreateAssignmentRequest = {
        taskId: unassignedTask.id,
        targetId: station.id,
        isOutsourced: false,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600000).toISOString(),
      };

      const assignment = await api.createAssignment(request);

      expect(assignment.id).toBeDefined();
      expect(assignment.taskId).toBe(request.taskId);
      expect(assignment.targetId).toBe(request.targetId);
      expect(assignment.isOutsourced).toBe(false);
      expect(assignment.isCompleted).toBe(false);
      expect(assignment.completedAt).toBeNull();
    });

    it('throws error for non-existent task', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      await api.getSnapshot();

      const request: CreateAssignmentRequest = {
        taskId: 'non-existent-task',
        targetId: 'some-station',
        isOutsourced: false,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date().toISOString(),
      };

      await expect(api.createAssignment(request)).rejects.toThrow(MockApiError);
      await expect(api.createAssignment(request)).rejects.toMatchObject({
        statusCode: 404,
        code: 'TASK_NOT_FOUND',
      });
    });

    it('throws error when task already has assignment', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      // Find an already assigned task
      const assignedTask = snapshot.tasks.find((task) =>
        snapshot.assignments.some((a) => a.taskId === task.id)
      );

      if (!assignedTask) {
        return; // No assigned tasks, skip test
      }

      const request: CreateAssignmentRequest = {
        taskId: assignedTask.id,
        targetId: 'some-station',
        isOutsourced: false,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date().toISOString(),
      };

      await expect(api.createAssignment(request)).rejects.toThrow(MockApiError);
      await expect(api.createAssignment(request)).rejects.toMatchObject({
        statusCode: 409,
        code: 'TASK_ALREADY_ASSIGNED',
      });
    });

    it('adds assignment to snapshot', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();
      const initialCount = snapshot.assignments.length;

      // Find an unassigned task
      const unassignedTask = snapshot.tasks.find(
        (task) => !snapshot.assignments.some((a) => a.taskId === task.id)
      );

      if (!unassignedTask) {
        return;
      }

      const station = snapshot.stations[0];
      await api.createAssignment({
        taskId: unassignedTask.id,
        targetId: station.id,
        isOutsourced: false,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date().toISOString(),
      });

      const updatedSnapshot = await api.getSnapshot();
      expect(updatedSnapshot.assignments.length).toBe(initialCount + 1);
    });
  });

  // ==========================================================================
  // updateAssignment Tests
  // ==========================================================================

  describe('updateAssignment', () => {
    it('updates assignment times', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      if (snapshot.assignments.length === 0) {
        return; // No assignments to update
      }

      const assignment = snapshot.assignments[0];
      const newStart = new Date(Date.now() + 86400000).toISOString();
      const newEnd = new Date(Date.now() + 90000000).toISOString();

      const updated = await api.updateAssignment(assignment.id, {
        scheduledStart: newStart,
        scheduledEnd: newEnd,
      });

      expect(updated.id).toBe(assignment.id);
      expect(updated.scheduledStart).toBe(newStart);
      expect(updated.scheduledEnd).toBe(newEnd);
      expect(updated.updatedAt).not.toBe(assignment.updatedAt);
    });

    it('allows partial update', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      if (snapshot.assignments.length === 0) {
        return;
      }

      const assignment = snapshot.assignments[0];
      const newStart = new Date(Date.now() + 86400000).toISOString();

      const updated = await api.updateAssignment(assignment.id, {
        scheduledStart: newStart,
      });

      expect(updated.scheduledStart).toBe(newStart);
      expect(updated.scheduledEnd).toBe(assignment.scheduledEnd);
    });

    it('throws error for non-existent assignment', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      await api.getSnapshot();

      await expect(
        api.updateAssignment('non-existent', { scheduledStart: new Date().toISOString() })
      ).rejects.toThrow(MockApiError);
      await expect(
        api.updateAssignment('non-existent', { scheduledStart: new Date().toISOString() })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // deleteAssignment Tests
  // ==========================================================================

  describe('deleteAssignment', () => {
    it('removes assignment from snapshot', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      if (snapshot.assignments.length === 0) {
        return;
      }

      const assignment = snapshot.assignments[0];
      const initialCount = snapshot.assignments.length;

      await api.deleteAssignment(assignment.id);

      const updatedSnapshot = await api.getSnapshot();
      expect(updatedSnapshot.assignments.length).toBe(initialCount - 1);
      expect(updatedSnapshot.assignments.find((a) => a.id === assignment.id)).toBeUndefined();
    });

    it('resets task status to Ready', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      if (snapshot.assignments.length === 0) {
        return;
      }

      const assignment = snapshot.assignments[0];
      const task = snapshot.tasks.find((t) => t.id === assignment.taskId);

      if (!task) {
        return;
      }

      await api.deleteAssignment(assignment.id);

      const updatedSnapshot = await api.getSnapshot();
      const updatedTask = updatedSnapshot.tasks.find((t) => t.id === assignment.taskId);
      expect(updatedTask?.status).toBe('Ready');
    });

    it('throws error for non-existent assignment', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      await api.getSnapshot();

      await expect(api.deleteAssignment('non-existent')).rejects.toThrow(MockApiError);
      await expect(api.deleteAssignment('non-existent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // toggleTaskCompletion Tests
  // ==========================================================================

  describe('toggleTaskCompletion', () => {
    it('toggles isCompleted from false to true', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      // Find an incomplete assignment
      const assignment = snapshot.assignments.find((a) => !a.isCompleted);

      if (!assignment) {
        return;
      }

      const updated = await api.toggleTaskCompletion(assignment.id);

      expect(updated.isCompleted).toBe(true);
      expect(updated.completedAt).toBeDefined();
      expect(updated.completedAt).not.toBeNull();
    });

    it('toggles isCompleted from true to false', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      // Find an incomplete assignment and complete it first
      const assignment = snapshot.assignments.find((a) => !a.isCompleted);

      if (!assignment) {
        return;
      }

      // Complete it
      await api.toggleTaskCompletion(assignment.id);

      // Toggle back
      const updated = await api.toggleTaskCompletion(assignment.id);

      expect(updated.isCompleted).toBe(false);
      expect(updated.completedAt).toBeNull();
    });

    it('throws error for non-existent assignment', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      await api.getSnapshot();

      await expect(api.toggleTaskCompletion('non-existent')).rejects.toThrow(MockApiError);
      await expect(api.toggleTaskCompletion('non-existent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
      });
    });

    it('updates assignment in snapshot', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      const assignment = snapshot.assignments.find((a) => !a.isCompleted);

      if (!assignment) {
        return;
      }

      await api.toggleTaskCompletion(assignment.id);

      const updatedSnapshot = await api.getSnapshot();
      const updatedAssignment = updatedSnapshot.assignments.find((a) => a.id === assignment.id);

      expect(updatedAssignment?.isCompleted).toBe(true);
    });
  });

  // ==========================================================================
  // reset Tests
  // ==========================================================================

  describe('reset', () => {
    it('invalidates the snapshot cache', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot1 = await api.getSnapshot();

      // Make a modification
      if (snapshot1.assignments.length > 0) {
        await api.deleteAssignment(snapshot1.assignments[0].id);
      }

      // Reset
      api.reset();

      // Get fresh snapshot - should have original assignment count
      const snapshot2 = await api.getSnapshot();
      expect(snapshot2.version).toBe(1); // Fresh snapshot starts at version 1
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    it('maintains data consistency across multiple operations', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      // Find an unassigned task
      const unassignedTask = snapshot.tasks.find(
        (task) => !snapshot.assignments.some((a) => a.taskId === task.id)
      );

      if (!unassignedTask) {
        return;
      }

      const station = snapshot.stations[0];

      // Create assignment
      const created = await api.createAssignment({
        taskId: unassignedTask.id,
        targetId: station.id,
        isOutsourced: false,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600000).toISOString(),
      });

      // Update assignment
      const newStart = new Date(Date.now() + 86400000).toISOString();
      const updated = await api.updateAssignment(created.id, {
        scheduledStart: newStart,
      });

      expect(updated.scheduledStart).toBe(newStart);

      // Toggle completion
      const completed = await api.toggleTaskCompletion(created.id);
      expect(completed.isCompleted).toBe(true);

      // Verify in snapshot
      const finalSnapshot = await api.getSnapshot();
      const finalAssignment = finalSnapshot.assignments.find((a) => a.id === created.id);

      expect(finalAssignment).toBeDefined();
      expect(finalAssignment?.isCompleted).toBe(true);
      expect(finalAssignment?.scheduledStart).toBe(newStart);

      // Delete assignment
      await api.deleteAssignment(created.id);

      // Verify removed
      const afterDelete = await api.getSnapshot();
      expect(afterDelete.assignments.find((a) => a.id === created.id)).toBeUndefined();
    });

    it('created assignments appear in subsequent getSnapshot calls', async () => {
      const api = createMockApi({ latencyMs: 0, latencyVariance: 0 });
      const snapshot = await api.getSnapshot();

      const unassignedTask = snapshot.tasks.find(
        (task) => !snapshot.assignments.some((a) => a.taskId === task.id)
      );

      if (!unassignedTask) {
        return;
      }

      const station = snapshot.stations[0];
      const created = await api.createAssignment({
        taskId: unassignedTask.id,
        targetId: station.id,
        isOutsourced: false,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3600000).toISOString(),
      });

      // Call getSnapshot again
      const newSnapshot = await api.getSnapshot();
      const foundAssignment = newSnapshot.assignments.find((a) => a.id === created.id);

      expect(foundAssignment).toBeDefined();
      expect(foundAssignment?.taskId).toBe(unassignedTask.id);
    });
  });

  // ==========================================================================
  // Default Instance Tests
  // ==========================================================================

  describe('mockApi default instance', () => {
    it('is a valid MockApi instance', () => {
      expect(mockApi).toBeDefined();
      expect(typeof mockApi.getSnapshot).toBe('function');
      expect(typeof mockApi.createAssignment).toBe('function');
      expect(typeof mockApi.updateAssignment).toBe('function');
      expect(typeof mockApi.deleteAssignment).toBe('function');
      expect(typeof mockApi.toggleTaskCompletion).toBe('function');
      expect(typeof mockApi.reset).toBe('function');
      expect(typeof mockApi.getConfig).toBe('function');
      expect(typeof mockApi.setConfig).toBe('function');
    });
  });
});
