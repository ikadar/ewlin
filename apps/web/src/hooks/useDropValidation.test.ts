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
  color: '#8b5cf6',
  paperPurchaseStatus: 'InStock',
  platesStatus: 'Done',
  proofSentAt: null,
  proofApprovedAt: null,
  requiredJobIds: [],
};

const mockInternalTask: Task = {
  id: 'task-1',
  jobId: 'job-1',
  type: 'Internal',
  name: 'Printing',
  stationId: 'station-1',
  estimatedMinutes: 60,
  sequenceNumber: 1,
  requiredTaskIds: [],
};

const mockOutsourcedTask: Task = {
  id: 'task-2',
  jobId: 'job-1',
  type: 'Outsourced',
  name: 'Lamination',
  outsourceTo: 'provider-1',
  estimatedMinutes: 120,
  sequenceNumber: 2,
  requiredTaskIds: ['task-1'],
};

const mockSnapshot: ScheduleSnapshot = {
  stations: [mockStation],
  stationGroups: [],
  jobs: [mockJob],
  tasks: [mockInternalTask, mockOutsourcedTask],
  assignments: [],
  providers: [],
  snapshotVersion: 1,
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
      conflicts: [{ type: 'StationUnavailable', message: 'Station not operating' }],
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
      conflicts: [{ type: 'PrecedenceConflict', message: 'Required task not completed' }],
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
