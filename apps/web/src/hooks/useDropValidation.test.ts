import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDropValidation, quickValidate } from './useDropValidation';
import type { ScheduleSnapshot, Task, Station, Job } from '@flux/types';

// Mock the schedule-validator module
vi.mock('@flux/schedule-validator', () => ({
  validateAssignment: vi.fn(),
  isValidAssignment: vi.fn(),
}));

import { validateAssignment, isValidAssignment } from '@flux/schedule-validator';

const mockValidateAssignment = vi.mocked(validateAssignment);
const mockIsValidAssignment = vi.mocked(isValidAssignment);

// Minimal mock data for tests
const mockStation: Station = {
  id: 'station-1',
  name: 'Test Station',
  status: 'Available',
  categoryId: 'cat-1',
  groupId: 'group-1',
  capacity: 1,
  operatingSchedule: {
    monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    saturday: { isOperating: false, slots: [] },
    sunday: { isOperating: false, slots: [] },
  },
  exceptions: [],
};

const mockJob: Job = {
  id: 'job-1',
  reference: '12345',
  client: 'Test Client',
  description: 'Test Job',
  status: 'Planned',
  workshopExitDate: '2025-12-20T18:00:00Z',
  fullyScheduled: false,
  color: '#8b5cf6',
  comments: [],
  elementIds: ['elem-1'],
  taskIds: ['task-1', 'task-2'],
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
    shipped: false,
    shippedAt: null,
};

const mockInternalTask: Task = {
  id: 'task-1',
  elementId: 'elem-1',
  type: 'Internal',
  stationId: 'station-1',
  sequenceOrder: 0,
  status: 'Defined',
  duration: { setupMinutes: 15, runMinutes: 45 },
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
};

const mockOutsourcedTask: Task = {
  id: 'task-2',
  elementId: 'elem-1',
  type: 'Outsourced',
  providerId: 'provider-1',
  actionType: 'Pelliculage',
  sequenceOrder: 1,
  status: 'Defined',
  duration: { openDays: 2, latestDepartureTime: '14:00', receptionTime: '09:00' },
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
};

const mockSnapshot: ScheduleSnapshot = {
  version: 1,
  generatedAt: '2025-12-01T00:00:00Z',
  stations: [mockStation],
  categories: [{ id: 'cat-1', name: 'Category 1', similarityCriteria: [] }],
  groups: [],
  jobs: [mockJob],
  elements: [
    {
      id: 'elem-1',
      jobId: 'job-1',
      name: 'Element 1',
      prerequisiteElementIds: [],
      taskIds: ['task-1', 'task-2'],
      paperStatus: 'none',
      batStatus: 'none',
      plateStatus: 'none',
      formeStatus: 'none',
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-01T00:00:00Z',
    },
  ],
  tasks: [mockInternalTask, mockOutsourcedTask],
  assignments: [],
  providers: [],
  lateJobs: [],
  conflicts: [],
};

describe('useDropValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not valid when task is null', () => {
    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: null,
        targetStationId: 'station-1',
        scheduledStart: '2025-12-16T10:00:00Z',
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.validationResult).toBeNull();
    expect(mockValidateAssignment).not.toHaveBeenCalled();
  });

  it('returns not valid when targetStationId is null', () => {
    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockInternalTask,
        targetStationId: null,
        scheduledStart: '2025-12-16T10:00:00Z',
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.validationResult).toBeNull();
    expect(mockValidateAssignment).not.toHaveBeenCalled();
  });

  it('returns not valid when scheduledStart is null', () => {
    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockInternalTask,
        targetStationId: 'station-1',
        scheduledStart: null,
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.validationResult).toBeNull();
    expect(mockValidateAssignment).not.toHaveBeenCalled();
  });

  it('returns not valid for outsourced tasks', () => {
    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockOutsourcedTask,
        targetStationId: 'station-1',
        scheduledStart: '2025-12-16T10:00:00Z',
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.validationResult).toBeNull();
    expect(mockValidateAssignment).not.toHaveBeenCalled();
  });

  it('calls validateAssignment for valid internal task', () => {
    mockValidateAssignment.mockReturnValue({
      valid: true,
      conflicts: [],
      suggestedStart: undefined,
    });

    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockInternalTask,
        targetStationId: 'station-1',
        scheduledStart: '2025-12-16T10:00:00Z',
      })
    );

    expect(mockValidateAssignment).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        targetId: 'station-1',
        isOutsourced: false,
        scheduledStart: '2025-12-16T10:00:00Z',
        bypassPrecedence: false,
      },
      mockSnapshot
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.hasPrecedenceConflict).toBe(false);
    expect(result.current.conflicts).toEqual([]);
  });

  it('returns isValid false when validation fails', () => {
    mockValidateAssignment.mockReturnValue({
      valid: false,
      conflicts: [{ type: 'AvailabilityConflict', message: 'Station not operating', taskId: 'task-1' }],
      suggestedStart: undefined,
    });

    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockInternalTask,
        targetStationId: 'station-1',
        scheduledStart: '2025-12-16T04:00:00Z',
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.conflicts).toHaveLength(1);
  });

  it('detects precedence conflict', () => {
    mockValidateAssignment.mockReturnValue({
      valid: false,
      conflicts: [{ type: 'PrecedenceConflict', message: 'Required task not completed', taskId: 'task-1' }],
      suggestedStart: '2025-12-16T12:00:00Z',
    });

    const { result } = renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockInternalTask,
        targetStationId: 'station-1',
        scheduledStart: '2025-12-16T10:00:00Z',
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.hasPrecedenceConflict).toBe(true);
    expect(result.current.suggestedStart).toBe('2025-12-16T12:00:00Z');
  });

  it('passes bypassPrecedence to validation', () => {
    mockValidateAssignment.mockReturnValue({
      valid: true,
      conflicts: [],
      suggestedStart: undefined,
    });

    renderHook(() =>
      useDropValidation({
        snapshot: mockSnapshot,
        task: mockInternalTask,
        targetStationId: 'station-1',
        scheduledStart: '2025-12-16T10:00:00Z',
        bypassPrecedence: true,
      })
    );

    expect(mockValidateAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        bypassPrecedence: true,
      }),
      mockSnapshot
    );
  });
});

describe('quickValidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for outsourced tasks without calling validator', () => {
    const result = quickValidate(
      mockSnapshot,
      mockOutsourcedTask,
      'station-1',
      '2025-12-16T10:00:00Z'
    );

    expect(result).toBe(false);
    expect(mockIsValidAssignment).not.toHaveBeenCalled();
  });

  it('calls isValidAssignment for internal tasks', () => {
    mockIsValidAssignment.mockReturnValue(true);

    const result = quickValidate(
      mockSnapshot,
      mockInternalTask,
      'station-1',
      '2025-12-16T10:00:00Z'
    );

    expect(mockIsValidAssignment).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        targetId: 'station-1',
        isOutsourced: false,
        scheduledStart: '2025-12-16T10:00:00Z',
        bypassPrecedence: false,
      },
      mockSnapshot
    );
    expect(result).toBe(true);
  });

  it('returns validation result from isValidAssignment', () => {
    mockIsValidAssignment.mockReturnValue(false);

    const result = quickValidate(
      mockSnapshot,
      mockInternalTask,
      'station-1',
      '2025-12-16T04:00:00Z'
    );

    expect(result).toBe(false);
  });

  it('passes bypassPrecedence parameter', () => {
    mockIsValidAssignment.mockReturnValue(true);

    quickValidate(mockSnapshot, mockInternalTask, 'station-1', '2025-12-16T10:00:00Z', true);

    expect(mockIsValidAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        bypassPrecedence: true,
      }),
      mockSnapshot
    );
  });
});
