/**
 * Mock API
 * Simulates backend HTTP calls for frontend development.
 */

import type {
  ScheduleSnapshot,
  TaskAssignment,
  Task,
} from '@flux/types';
import { getSnapshot, updateSnapshot, invalidateSnapshot } from './snapshot';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for mock API behavior
 */
export interface MockApiConfig {
  /** Base latency in milliseconds (default: 200) */
  latencyMs: number;
  /** Random variance added to latency (default: 100) */
  latencyVariance: number;
  /** Probability of simulated failure 0-1 (default: 0) */
  failureRate: number;
}

/**
 * Request body for creating a new assignment
 */
export interface CreateAssignmentRequest {
  taskId: string;
  targetId: string;
  isOutsourced: boolean;
  scheduledStart: string;
  scheduledEnd: string;
}

/**
 * Request body for updating an assignment
 */
export interface UpdateAssignmentRequest {
  scheduledStart?: string;
  scheduledEnd?: string;
}

/**
 * API error response
 */
export class MockApiError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'MOCK_API_ERROR') {
    super(message);
    this.name = 'MockApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MockApiConfig = {
  latencyMs: 200,
  latencyVariance: 100,
  failureRate: 0,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simulate network latency
 */
export function simulateLatency(config: MockApiConfig): Promise<void> {
  const variance = Math.random() * config.latencyVariance;
  const delay = config.latencyMs + variance;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Simulate random API failure
 */
export function simulateFailure(config: MockApiConfig): void {
  if (config.failureRate > 0 && Math.random() < config.failureRate) {
    throw new MockApiError(
      'Simulated network failure',
      503,
      'SIMULATED_FAILURE'
    );
  }
}

/**
 * Generate unique ID for new assignments
 */
function generateId(): string {
  return `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// Mock API Implementation
// ============================================================================

export interface MockApi {
  /** Get complete schedule snapshot */
  getSnapshot(): Promise<ScheduleSnapshot>;

  /** Create a new task assignment */
  createAssignment(request: CreateAssignmentRequest): Promise<TaskAssignment>;

  /** Update an existing assignment */
  updateAssignment(id: string, request: UpdateAssignmentRequest): Promise<TaskAssignment>;

  /** Delete an assignment (recall tile) */
  deleteAssignment(id: string): Promise<void>;

  /** Toggle task completion status */
  toggleTaskCompletion(assignmentId: string): Promise<TaskAssignment>;

  /** Reset mock data (invalidate cache) */
  reset(): void;

  /** Get current configuration */
  getConfig(): MockApiConfig;

  /** Update configuration */
  setConfig(config: Partial<MockApiConfig>): void;
}

/**
 * Create a mock API instance with the given configuration
 */
export function createMockApi(initialConfig: Partial<MockApiConfig> = {}): MockApi {
  let config: MockApiConfig = { ...DEFAULT_CONFIG, ...initialConfig };

  return {
    async getSnapshot(): Promise<ScheduleSnapshot> {
      await simulateLatency(config);
      simulateFailure(config);
      return getSnapshot();
    },

    async createAssignment(request: CreateAssignmentRequest): Promise<TaskAssignment> {
      await simulateLatency(config);
      simulateFailure(config);

      const snapshot = getSnapshot();

      // Validate task exists
      const task = snapshot.tasks.find((t) => t.id === request.taskId);
      if (!task) {
        throw new MockApiError(`Task not found: ${request.taskId}`, 404, 'TASK_NOT_FOUND');
      }

      // Check if task already has an assignment
      const existingAssignment = snapshot.assignments.find(
        (a) => a.taskId === request.taskId
      );
      if (existingAssignment) {
        throw new MockApiError(
          `Task already has an assignment: ${request.taskId}`,
          409,
          'TASK_ALREADY_ASSIGNED'
        );
      }

      // Create new assignment
      const newAssignment: TaskAssignment = {
        id: generateId(),
        taskId: request.taskId,
        targetId: request.targetId,
        isOutsourced: request.isOutsourced,
        scheduledStart: request.scheduledStart,
        scheduledEnd: request.scheduledEnd,
        isCompleted: false,
        completedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };

      // Update snapshot
      updateSnapshot((s) => ({
        ...s,
        assignments: [...s.assignments, newAssignment],
        tasks: s.tasks.map((t): Task =>
          t.id === request.taskId ? { ...t, status: 'Assigned' } : t
        ),
      }));

      return newAssignment;
    },

    async updateAssignment(
      id: string,
      request: UpdateAssignmentRequest
    ): Promise<TaskAssignment> {
      await simulateLatency(config);
      simulateFailure(config);

      const snapshot = getSnapshot();

      // Find existing assignment
      const existingIndex = snapshot.assignments.findIndex((a) => a.id === id);
      if (existingIndex === -1) {
        throw new MockApiError(`Assignment not found: ${id}`, 404, 'ASSIGNMENT_NOT_FOUND');
      }

      const existing = snapshot.assignments[existingIndex];

      // Create updated assignment
      const updated: TaskAssignment = {
        ...existing,
        scheduledStart: request.scheduledStart ?? existing.scheduledStart,
        scheduledEnd: request.scheduledEnd ?? existing.scheduledEnd,
        updatedAt: now(),
      };

      // Update snapshot
      updateSnapshot((s) => ({
        ...s,
        assignments: s.assignments.map((a) => (a.id === id ? updated : a)),
      }));

      return updated;
    },

    async deleteAssignment(id: string): Promise<void> {
      await simulateLatency(config);
      simulateFailure(config);

      const snapshot = getSnapshot();

      // Find existing assignment
      const existing = snapshot.assignments.find((a) => a.id === id);
      if (!existing) {
        throw new MockApiError(`Assignment not found: ${id}`, 404, 'ASSIGNMENT_NOT_FOUND');
      }

      // Update snapshot - remove assignment and reset task status
      updateSnapshot((s) => ({
        ...s,
        assignments: s.assignments.filter((a) => a.id !== id),
        tasks: s.tasks.map((t): Task =>
          t.id === existing.taskId ? { ...t, status: 'Ready' } : t
        ),
      }));
    },

    async toggleTaskCompletion(assignmentId: string): Promise<TaskAssignment> {
      await simulateLatency(config);
      simulateFailure(config);

      const snapshot = getSnapshot();

      // Find existing assignment
      const existingIndex = snapshot.assignments.findIndex(
        (a) => a.id === assignmentId
      );
      if (existingIndex === -1) {
        throw new MockApiError(
          `Assignment not found: ${assignmentId}`,
          404,
          'ASSIGNMENT_NOT_FOUND'
        );
      }

      const existing = snapshot.assignments[existingIndex];
      const newIsCompleted = !existing.isCompleted;

      // Create updated assignment
      const updated: TaskAssignment = {
        ...existing,
        isCompleted: newIsCompleted,
        completedAt: newIsCompleted ? now() : null,
        updatedAt: now(),
      };

      // Update snapshot
      updateSnapshot((s) => ({
        ...s,
        assignments: s.assignments.map((a) =>
          a.id === assignmentId ? updated : a
        ),
      }));

      return updated;
    },

    reset(): void {
      invalidateSnapshot();
    },

    getConfig(): MockApiConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<MockApiConfig>): void {
      config = { ...config, ...newConfig };
    },
  };
}

// ============================================================================
// Default Instance
// ============================================================================

/**
 * Default mock API instance with standard configuration
 */
export const mockApi = createMockApi();
